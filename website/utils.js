const fs = require('fs');
const path = require('path');

const getSkinsFromJson = (language = 'skins_en') => {
    const skins = {};
    const filePath = path.join(__dirname, 'data', `${language}.json`);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const skin of json) {
        const defindex = parseInt(skin.weapon_defindex, 10);
        const paint = parseInt(skin.paint, 10);

        if (!skins[defindex]) {
            skins[defindex] = {};
        }

        skins[defindex][paint] = {
            weapon_name: skin.weapon_name,
            paint_name: skin.paint_name,
            image_url: skin.image,
        };
    }

    return skins;
};

const getWeaponsFromArray = (language = 'skins_en') => {
    const weapons = {};
    const temp = getSkinsFromJson(language);

    for (const [key, value] of Object.entries(temp)) {
        if (weapons[key]) continue;

        const firstPaintKey = Object.keys(value)[0]; // It was 0 in PHP, but objects aren't guaranteed to be 0
        const firstPaint = value[0] || value[firstPaintKey];

        weapons[key] = {
            weapon_name: firstPaint.weapon_name,
            paint_name: firstPaint.paint_name,
            image_url: firstPaint.image_url,
        };
    }

    return weapons;
};

const getKnifeTypes = (language = 'skins_en') => {
    const knifes = {};
    const temp = getWeaponsFromArray(language);
    const validKnifeIds = [
        500, 503, 505, 506, 507, 508, 509, 512, 514, 515, 516, 517, 518, 519, 520, 521, 522, 523, 525, 526
    ];

    for (const [key, weapon] of Object.entries(temp)) {
        const numKey = parseInt(key, 10);
        if (!validKnifeIds.includes(numKey)) continue;

        knifes[numKey] = {
            weapon_name: weapon.weapon_name,
            paint_name: weapon.paint_name.split('|')[0].trim(),
            image_url: weapon.image_url,
        };
    }

    knifes[0] = {
        weapon_name: "weapon_knife",
        paint_name: "Default knife",
        image_url: "https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_knife.png",
    };

    // Sort by keys
    const sortedKnifes = {};
    Object.keys(knifes)
        .map(Number)
        .sort((a, b) => a - b)
        .forEach(key => {
            sortedKnifes[key] = knifes[key];
        });

    return sortedKnifes;
};

const getSelectedSkins = (temp) => {
    const selected = {};

    for (const weapon of temp) {
        selected[weapon.weapon_defindex] = {
            weapon_paint_id: weapon.weapon_paint_id,
            weapon_seed: weapon.weapon_seed,
            weapon_wear: weapon.weapon_wear,
        };
    }

    return selected;
};

module.exports = {
    getSkinsFromJson,
    getWeaponsFromArray,
    getKnifeTypes,
    getSelectedSkins
};