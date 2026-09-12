SELECT 'MemeEntry' t, count(*) total, count("shortAnswer") sa, count(definition) def, count("searchIntentType") sit FROM "MemeEntry"
UNION ALL SELECT 'ExpressionEntry', count(*), count("shortAnswer"), count(definition), count("searchIntentType") FROM "ExpressionEntry"
UNION ALL SELECT 'SceneEntry', count(*), count("shortAnswer"), count(definition), count("searchIntentType") FROM "SceneEntry"
UNION ALL SELECT 'MenuEntry', count(*), count("shortAnswer"), count(definition), count("searchIntentType") FROM "MenuEntry"
UNION ALL SELECT 'RecipeEntry', count(*), count("shortAnswer"), count(definition), count("searchIntentType") FROM "RecipeEntry";
