require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const mysql = require('mysql2/promise');
const path = require('path');
const { getSkinsFromJson, getWeaponsFromArray, getKnifeTypes, getSelectedSkins } = require('./utils');

const app = express();
const port = process.process?.env?.PORT || 3000;

// Database connection
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cs2_weaponpaints',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Configure Passport
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(new SteamStrategy({
        returnURL: `${process.env.STEAM_DOMAIN_NAME || 'http://localhost:' + port}/auth/steam/return`,
        realm: `${process.env.STEAM_DOMAIN_NAME || 'http://localhost:' + port}/`,
        apiKey: process.env.STEAM_API_KEY
    },
    function(identifier, profile, done) {
        // identifier is the steamid64 URL
        process.nextTick(function () {
            profile.identifier = identifier;
            profile.steamid = profile.id; // Get Steam64 ID
            return done(null, profile);
        });
    }
));

// Express configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'img'))); // Serve images

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'cs2weaponpaints-secret',
    name: 'cs2weaponpaints session',
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get('/', async (req, res) => {
    const user = req.user;
    let selectedSkins = {};
    let selectedKnife = null;
    
    const language = process.env.SKIN_LANGUAGE || 'skins_en';
    const skins = getSkinsFromJson(language);
    const weapons = getWeaponsFromArray(language);
    const knifes = getKnifeTypes(language);

    if (user) {
        const steamid = user.steamid;
        
        try {
            const [querySelected] = await pool.query(`
                SELECT weapon_defindex, MAX(weapon_paint_id) AS weapon_paint_id, MAX(weapon_wear) AS weapon_wear, MAX(weapon_seed) AS weapon_seed
                FROM wp_player_skins
                WHERE steamid = ?
                GROUP BY weapon_defindex, steamid
            `, [steamid]);
            
            selectedSkins = getSelectedSkins(querySelected);
            
            const [knifeRows] = await pool.query(`SELECT * FROM wp_player_knife WHERE steamid = ? LIMIT 1`, [steamid]);
            selectedKnife = knifeRows.length > 0 ? knifeRows : null;
        } catch (error) {
            console.error('Database Error:', error);
        }
    }

    res.render('index', {
        user,
        skins,
        weapons,
        knifes,
        selectedSkins,
        selectedKnife,
        webStyleDark: process.env.WEB_STYLE_DARK === 'true'
    });
});

app.post('/', async (req, res) => {
    if (!req.user) {
        return res.redirect('/');
    }

    const steamid = req.user.steamid;
    const forma = req.body.forma;
    
    if (forma) {
        const ex = forma.split('-');
        
        try {
            if (ex[0] === "knife") {
                const language = process.env.SKIN_LANGUAGE || 'skins_en';
                const knifes = getKnifeTypes(language);
                const knifeKey = parseInt(ex[1], 10);
                const knifeName = knifes[knifeKey].weapon_name;

                await pool.query(`INSERT INTO wp_player_knife (steamid, knife, weapon_team) VALUES(?, ?, 2) ON DUPLICATE KEY UPDATE knife = ?`, [steamid, knifeName, knifeName]);
                await pool.query(`INSERT INTO wp_player_knife (steamid, knife, weapon_team) VALUES(?, ?, 3) ON DUPLICATE KEY UPDATE knife = ?`, [steamid, knifeName, knifeName]);
            } else {
                const defindex = parseInt(ex[0], 10);
                const paintId = parseInt(ex[1], 10);
                
                const wear = req.body.wear ? parseFloat(req.body.wear) : null;
                const seed = req.body.seed ? parseInt(req.body.seed, 10) : null;
                
                if (wear >= 0.00 && wear <= 1.00 && seed !== null) {
                    // Check if skin is already selected for this weapon
                    const [existing] = await pool.query(`SELECT * FROM wp_player_skins WHERE steamid = ? AND weapon_defindex = ?`, [steamid, defindex]);
                    
                    if (existing.length > 0) {
                        await pool.query(`UPDATE wp_player_skins SET weapon_paint_id = ?, weapon_wear = ?, weapon_seed = ? WHERE steamid = ? AND weapon_defindex = ?`, [paintId, wear, seed, steamid, defindex]);
                    } else {
                        await pool.query(`INSERT INTO wp_player_skins (steamid, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed, weapon_team) VALUES (?, ?, ?, ?, ?, 2)`, [steamid, defindex, paintId, wear, seed]);
                        await pool.query(`INSERT INTO wp_player_skins (steamid, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed, weapon_team) VALUES (?, ?, ?, ?, ?, 3)`, [steamid, defindex, paintId, wear, seed]);
                    }
                }
            }
        } catch (error) {
            console.error('Database Error during POST:', error);
        }
    }
    
    res.redirect('/');
});

// Steam Auth Routes
app.get('/auth/steam',
  passport.authenticate('steam', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/auth/steam/return',
  passport.authenticate('steam', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout(function(err) {
      res.redirect('/');
  });
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});