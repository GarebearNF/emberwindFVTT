import { updateEffectStack } from '../apps/EffectIteration.mjs';
import { TextEnricher } from '../apps/TextEnricher.mjs';
import { EFFECTS } from "../helpers/effects-config.mjs";
import { ItemTextEnricher } from '../apps/TextEnricher.mjs';
import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
 
export class EmberActorSheet extends ActorSheet {
	
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['emberwind', 'sheet', 'actor'],
      width: 850,
      height: 700,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'actions',
        },
      ],
    });
  }

  /** @override */
  get template() {
    return `systems/emberwind/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = await super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.data;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (['hero-aspect', 'hero-attribute'].includes(actorData.type)) {
		this._prepareItems(context);
		this._prepareCharacterData(context);
	} else if (actorData.type === 'foe') {
		this._prepareItems(context);
	}
	console.log("Actor Class: ", this.actor.constructor.name);
	console.log("Actor Data: ", this.actor);
	console.log("Roll Data: ", this.actor.getRollData ? this.actor.getRollData() : "getRollData is not a function");
    // Add roll data for TinyMCE editors.
    if (this.actor && typeof this.actor.getRollData === 'function') {
		context.rollData = this.actor.getRollData();
	} else {
		console.error("Error: Actor does not have getRollData method.");
	}
	
	for (let item of context.items) {
		const itemId = `Actor.${this.actor._id}.Item.${item._id}`
		console.log("Item Data: ", item);
		console.log("Roll Data: ", item.getRollData ? item.getRollData() : "getRollData is not a function");
		if (item.system.effect) {
			item.enrichedEffect = await ItemTextEnricher.enrichText(item.system.effect, itemId); // Passing actor
		}
		if (item.system.description) {
			item.enrichedDescription = await ItemTextEnricher.enrichText(item.system.description, itemId); // Passing actor
		}
	}
	
	const actor = this.actor;
	const effectStacks = await actor.getFlag("emberwind", "effectStacks") || {}; // Ensure an empty object fallback
	console.log(effectStacks);  // Log the current effect stacks to ensure they're set
	const stackValueBurn = effectStacks["apply-burning"] || 0;  // Use default value of 0 if not found
	context.stackValueBurning = stackValueBurn;

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );
	
	// Enrich text fields if they are not null
	  if (actorData.system.anchors !== null) {
		context.enrichedAnchors = await TextEnricher.enrichText(this.actor.system.anchors, this.actor);
	  }
  
	  if (actorData.system.deadweight !== null) {
		context.enrichedDeadweight = await TextEnricher.enrichText(this.actor.system.deadweight, this.actor);
	  }
	  
	  context.tier = CONFIG.EMBER.heroTiers;
        return context;

  }



  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle ability scores.
    for (let [k, v] of Object.entries(context.system.abilities)) {
      v.label = game.i18n.localize(CONFIG.EMBER.abilities[k]) ?? k;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
	const actions = [];
    const classes = [];
	const classactions = [];
	const classtraits = [];
	const classtts = [];
	const maneuvers = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to actions.
      if (i.type === 'item') {
        gear.push(i);
      }
      // Append to classes.
      else if (i.type === 'class' || i.type === 'subclass') {
        classes.push(i);
      }
	  else if (i.type === 'class-action' || i.type === 'class-trait') {
        classactions.push(i);
      }
	  else if (i.type === 'class-tt-action') {
        classtts.push(i);
      }
	  else if (i.type === 'maneuver') {
        maneuvers.push(i);
      }
    }
	for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to actions.
      if (i.type === 'item' && i.system.equipped) {
        actions.push(i);
      }
    }

    // Assign and return
    context.gear = gear;
	context.classes = classes;
	context.classactions = classactions;
	context.actions = actions;
	context.classtts = classtts;
	context.maneuvers = maneuvers;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });
	
	html.on('click', '.item-equip', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      const isEquipped = item.system.equipped; // Check current equipped state
	  item.update({ "system.equipped": !isEquipped }); // Toggle equipped state
    });

	
	// Event listeners for increment and decrement buttons
        html.find(".effect-increment").on("click", this._onIncrement.bind(this));
        html.find(".effect-decrement").on("click", this._onDecrement.bind(this));


    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system['type'];

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }
  
  // Handling increment directly
async _onIncrement(event) {
  const inputId = event.currentTarget.id.replace('-increment', '');
  const effectData = EFFECTS[inputId];
  if (!effectData) {
    console.error(`Error: No effect data found for input ID ${inputId}`);
    return;
  }

  const maxStacks = effectData.maxStacks;
  const effectStacks = await this.actor.getFlag("emberwind", "effectStacks") || {};
  let currentStack = effectStacks[inputId] || 0;

  if (currentStack < maxStacks) {
    currentStack += 1;
    await updateEffectStack(this.actor, inputId, currentStack);
  }
}

// Handling decrement directly
async _onDecrement(event) {
  const inputId = event.currentTarget.id.replace('-decrement', '');  // Get the corresponding input ID
  const effectData = EFFECTS[inputId];
  if (!effectData) {
    console.error(`Error: No effect data found for input ID ${inputId}`);
    return;
  }

  const effectStacks = await this.actor.getFlag("emberwind", "effectStacks") || {};
  let currentStack = effectStacks[inputId] || 0;

  if (currentStack > 0) {
    // Decrement the stack value
    currentStack -= 1;

    // Update the effect stack in the actor's flags
    await updateEffectStack(this.actor, inputId, currentStack);
  }
}



  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item and skill rolls.
	if (dataset.rollType) {
		const rollType = dataset.rollType;

		if (rollType === 'item') {
			const itemId = element.closest('.item').dataset.itemId;
			const item = this.actor.items.get(itemId);
			if (item) return item.roll();
		} else if (rollType === 'skill') {
			const skillKey = dataset.skill;  // dataset.skill is the skill identifier (e.g., "athletics")
			const localizedSkillLabel = game.i18n.localize(CONFIG.EMBER.skills[skillKey] || `EMBER.Skill.${skillKey}`);
			let skillData;
			if (['dodge', 'resist', 'tough', 'will'].includes(skillKey)) {
				skillData = this.actor.system.abilities[skillKey].value;
			} else {skillData = this.actor.system.stats[skillKey].value;}
			
			// Open dialog to query for advantages and disadvantages
        new Dialog({
            title: `${localizedSkillLabel} Check`,  // Display the skill name in the dialog title
            content: `
                <div class="grid grid-4col">
				<h3 class="grid-span-4">Enter the number of Advantages and Disadvantages:</h3>
                <label for="advantages" class="grid-span-1">Advantages:</label>
                <input class="grid-span-1" type="number" id="advantages" value="0" min="0"/>
                <label for="disadvantages" class="grid-span-1">Disadvantages:</label>
                <input class="grid-span-1" type="number" id="disadvantages" value="0" min="0"/>
				</div>
            `,
            buttons: {
                roll: {
                    label: "Roll",
                    callback: async (html) => {
                        const advantages = parseInt(html.find('#advantages').val()) || 0;
                        const disadvantages = parseInt(html.find('#disadvantages').val()) || 0;
                        
                        const keep = advantages > disadvantages ? 'kl' : 'kh';
                        const numDice = 1 + Math.abs(advantages - disadvantages);
						const bonus = this.actor.system.abilities[skillKey].bonus;
                        
                        const roll = new Roll(`${numDice}d20${keep}+${bonus}`);
                        await roll.evaluate();

                        if (game.dice3d) {
                            await game.dice3d.showForRoll(roll, game.user, true);
                        }

                        const dieResults = roll.terms.flatMap(term => {
                            if (term instanceof foundry.dice.terms.Die) {
                                return term.results.map(result => ({
                                    type: term.faces,
                                    result: result.result
                                }));
                            }
                            return [];
                        });

                        const tooltipContent = dieResults.map(({ type, result }) => 
                            `<span class="roll die d${type}">${result}</span>`
                        ).join(' ');
						
						let skillCategory;
						if (['tough', 'ath', 'end', 'int'].includes(skillKey)) {
							skillCategory = 'tough';
						} else if (['resist', 'ins', 'kno', 'men'].includes(skillKey)) {
							skillCategory = 'resist';
						} else if (['dodge', 'acr', 'ste', 'soh'].includes(skillKey)) {
							skillCategory = 'dodge';
						} else if (['will', 'foc', 'fas', 'lea'].includes(skillKey)) {
							skillCategory = 'will';
						}
						
						
						let checkStatus = roll.total > skillData ? 'Fail' : 'Success';
						
                        const templateData = {
                            actor: this.actor,
                            rollResult: roll.total,  // Use roll.total for final result
                            tooltipFinal: tooltipContent,
							skillLabel: localizedSkillLabel,
							skillData: skillData,
							skillCategory: skillCategory,
							checkStatus: checkStatus,
                            rollFormula: roll.formula
                        };

                        const htmlContent = await renderTemplate("systems/emberwind/templates/chat/skill-roll.hbs", templateData);

                        // Send the result to chat
                        ChatMessage.create({
                            content: htmlContent,
                            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                        });
						}
					}
				}
			}).render(true);
		}
	}

    
    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
        let label = dataset.label ? `[ability] ${dataset.label}` : '';
        let roll = new Roll(dataset.roll, this.actor.getRollData());
        roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: label,
            rollMode: game.settings.get('core', 'rollMode'),
        });
        return roll;
    }
}

}
