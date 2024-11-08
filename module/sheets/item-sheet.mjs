import { TextEnricher } from '../apps/TextEnricher.mjs';
import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class EmberItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['emberwind', 'sheet', 'item'],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'details',
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = 'systems/emberwind/templates/item';
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.hbs`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.hbs`.
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve base data structure.
    const context = await super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = context.data;

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = this.item.getRollData();

    // Add the item's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;
	
	// Enrich text fields if they are not null
	  if (itemData.system.description !== null) {
		context.enrichedDescription = await TextEnricher.enrichText(this.item.system.description, this.item);
	  }
  
	  if (itemData.system.effect !== null) {
		context.enrichedEffect = await TextEnricher.enrichText(this.item.system.effect, this.item);
	  }

    // Prepare active effects for easier access
    context.effects = prepareActiveEffectCategories(this.item.effects);
	context.skills = CONFIG.EMBER.skills;
	context.tiers = CONFIG.EMBER.heroTiers;
	context.classes = CONFIG.EMBER.classes;
	context.barriers = CONFIG.EMBER.barriers;
	context.dice = CONFIG.EMBER.dice;
    return context;

  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers, click handlers, etc. would go here.

    // Active Effect management
    html.on('click', '.effect-control', (ev) =>
      onManageActiveEffect(ev, this.item)
    );
  }
}
