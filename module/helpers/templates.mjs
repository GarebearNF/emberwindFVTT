/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/emberwind/templates/actor/parts/actor-features.hbs',
    'systems/emberwind/templates/actor/parts/actor-items.hbs',
    'systems/emberwind/templates/actor/parts/actor-spells.hbs',
    'systems/emberwind/templates/actor/parts/actor-effects.hbs',
	'systems/emberwind/templates/actor/parts/actor-conditions.hbs',
	'systems/emberwind/templates/actor/parts/actor-conditions-foe.hbs',
	'systems/emberwind/templates/actor/parts/actor-maneuver.hbs',
	'systems/emberwind/templates/actor/parts/actor-basic-action.hbs',
	'systems/emberwind/templates/actor/parts/actor-class-action.hbs',
	'systems/emberwind/templates/actor/parts/actor-class-tt.hbs',
	'systems/emberwind/templates/actor/parts/actor-class.hbs',
    // Item partials
    'systems/emberwind/templates/item/parts/item-effects.hbs',
	'systems/emberwind/templates/item/parts/item-tooltip.hbs',
	// Chat partials
	'systems/emberwind/templates/chat/parts/roll-utilities.hbs',
  ]);
};
