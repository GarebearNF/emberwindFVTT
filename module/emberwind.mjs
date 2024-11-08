import { updateEffectStack } from './apps/EffectIteration.mjs';
// Import effects config
import { EFFECTS } from "./helpers/effects-config.mjs";
// Import document classes.
import { EmberActor } from './documents/actor.mjs';
import { EmberItem } from './documents/item.mjs';
// Import text enrichment class.
import { TextEnricher } from './apps/TextEnricher.mjs';
console.log("TextEnricher imported", TextEnricher);
// Import sheet classes.
import { EmberActorSheet } from './sheets/actor-sheet.mjs';
import { EmberItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { EMBER } from './helpers/config.mjs';


/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function () {
  console.log("Status: Initializing Emberwind system.");
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.emberwind = {
    EmberActor,
    EmberItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.EMBER = EMBER;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '1d20 + @abilities.dex.mod',
    decimals: 2,
  };

  // Define custom Document classes
  console.log("Status: Defining custom Document classes.");
  CONFIG.Actor.documentClass = EmberActor;
  CONFIG.Item.documentClass = EmberItem;

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;
  
  // Example of adding custom effects to token HUD
  for (const effectKey in EFFECTS) {
      const effectData = EFFECTS[effectKey];
      // You may add logic here to replace, remove, or initialize effects on the HUD
  }

  // Register sheet application classes
  console.log("Status: Registering sheet application classes.");
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('emberwind', EmberActorSheet, {
    makeDefault: true,
    label: 'EMBER.SheetLabels.Actor',
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('emberwind', EmberItemSheet, {
    makeDefault: true,
    label: 'EMBER.SheetLabels.Item',
  });

  // Preload Handlebars templates.
  console.log("Status: Preload Handlebars templates.");
  return preloadHandlebarsTemplates();
  
  console.log("Status: Emberwind system successfully loaded!");
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.emberwind.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'emberwind.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}

Hooks.on('renderChatMessage', (message, html, data) => {
    // Open Item Description Toggle
    html.find('.roll-header').click(function() {
        const description = $(this).next('.roll-description');
        description.toggle();
        description.toggleClass('visible');
        
        const arrow = $(this).find('.roll-header-toggle-arrow');
        arrow.toggleClass('flip');
    });

    // Standard Damage Roll Button
    html.find('.roll-damage-button').click(async function() {
        try {
            const itemId = message.flags?.itemId;
            if (!itemId) throw new Error("Item ID not found in message flags.");

            const item = await fromUuid(itemId);
            if (!item) throw new Error("Item not found.");
            const actor = item.actor;
            if (!actor) throw new Error("Actor not found.");

            // Get roll data from the item
            const rollData = item.getRollData();
            const formula = rollData?.formula;
            if (!formula) throw new Error("Roll formula is undefined.");

            // Retrieve the barrier value
            const barrierValue = item.system?.barrier ?? 0;

            // Roll damage
            const roll = new Roll(formula, rollData);
            await roll.evaluate();
            
            // Show roll with Dice So Nice, if available
            if (game.dice3d) {
                await game.dice3d.showForRoll(roll, game.user, true);
            }

            // Prepare data for tooltip
            const dieResults = roll.terms.flatMap(term => 
				term instanceof foundry.dice.terms.Die
					? term.results.map(r => `<span class="roll die d${term.faces}">${r.result}</span>`)
					: []
			);
            const tooltipString = dieResults.join(' ');

            const templateData = {
                actor: actor,
                item: item,
                rollResult: roll.total,
                tooltipFinal: tooltipString,
                rollFormula: roll.formula
            };

            const htmlContent = await renderTemplate("systems/emberwind/templates/chat/basic-roll.hbs", templateData);

            // Send roll result to chat with roll data and barrier stored in flags
            ChatMessage.create({
                flavor: `${item.name} Damage:`,
                content: htmlContent,
                speaker: ChatMessage.getSpeaker({ actor }),
                flags: {
                    emberwind: {
                        rollTotal: roll.total,
                        rollFormula: roll.formula,
                        itemId: itemId,
                        barrier: barrierValue // Store barrier value here
                    }
                }
            });
        } catch (error) {
            console.error("An error occurred during the damage roll:", error);
        }
    });
	
	// Critical Damage Roll Button
    html.find('.crit-damage-button').click(async function() {
        try {
            const itemId = message.flags?.itemId;
            if (!itemId) throw new Error("Item ID not found in message flags.");

            const item = await fromUuid(itemId);
            if (!item) throw new Error("Item not found.");
            const actor = item.actor;
            if (!actor) throw new Error("Actor not found.");

            // Get roll data from the item
            const rollData = item.getRollData();
            const formula = rollData?.formula;
            if (!formula) throw new Error("Roll formula is undefined.");

            // Retrieve the barrier value
            const barrierValue = item.system?.barrier ?? 0;

            // Roll damage
            const roll = new Roll(formula, rollData);
            await roll.evaluate({ maximize: true });
            
            // Show roll with Dice So Nice, if available
            if (game.dice3d) {
                await game.dice3d.showForRoll(roll, game.user, true);
            }

            // Prepare data for tooltip
            const dieResults = roll.terms.flatMap(term => 
				term instanceof foundry.dice.terms.Die
					? term.results.map(r => `<span class="roll die d${term.faces}">${r.result}</span>`)
					: []
			);
            const tooltipString = dieResults.join(' ');

            const templateData = {
                actor: actor,
                item: item,
                rollResult: roll.total,
                tooltipFinal: tooltipString,
                rollFormula: roll.formula
            };

            const htmlContent = await renderTemplate("systems/emberwind/templates/chat/basic-roll.hbs", templateData);

            // Send roll result to chat with roll data and barrier stored in flags
            ChatMessage.create({
                flavor: `${item.name} Damage:`,
                content: htmlContent,
                speaker: ChatMessage.getSpeaker({ actor }),
                flags: {
                    emberwind: {
                        rollTotal: roll.total,
                        rollFormula: roll.formula,
                        itemId: itemId,
                        barrier: barrierValue // Store barrier value here
                    }
                }
            });
        } catch (error) {
            console.error("An error occurred during the damage roll:", error);
        }
    });

    // Damage and Healing Application Buttons
    const rollTotal = message.flags?.emberwind?.rollTotal ?? message.roll?.total;
    const barrierValue = message.flags?.emberwind?.barrier; // Retrieve barrier value
	const localizedBarrier = game.i18n.localize(CONFIG.EMBER.barriers[barrierValue]) || game.i18n.localize(`EMBER.Ability.${barrierValue}.long`);
    if (!rollTotal) return;

    // Utility function to get selected token
    function getSelectedToken() {
        const token = canvas.tokens.controlled[0];
        if (!token) {
            ui.notifications.warn("No token is selected.");
            return null;
        }
        return token;
    }

    // Full Damage Button
    html.find('.apply-full-damage').click(async () => {
        const token = getSelectedToken();
        if (token) await token.actor.applyDamage(rollTotal);
    });

    // Damage Minus Defense Button
    html.find('.apply-damage-defense').click(async () => {
        const token = getSelectedToken();
        if (!token) return;

        new Dialog({
            title: "Defense Query",
            content: `<p>Enter target's ${localizedBarrier} value.:</p><input type="number" id="defense-value" value="0"/>`,
            buttons: {
                apply: {
                    label: "Apply",
                    callback: async (html) => {
                        const defenseValue = parseInt(html.find("#defense-value").val()) || 0;
                        const damageAmount = Math.max(0, rollTotal - defenseValue);
                        await token.actor.applyDamage(damageAmount);
                    }
                }
            }
        }).render(true);
    });

    // Healing Button
    html.find('.apply-healing').click(async () => {
        const token = getSelectedToken();
        if (token) await token.actor.applyHealing(rollTotal);
    });
});

Hooks.on('renderTokenHUD', (hud, html, token) => {
    const customEffects = EFFECTS;
	// Retrieve the actorId from the token
    const actorId = token.actorId;

    // Query the actor using the actorId
    const actor = game.actors.get(actorId);

    if (actor) {
        // Access actor's data or specific attributes
        console.log("Actor Data:", actor.system);

        // You can now use actor data to manipulate the HUD or display specific information
        hud.updateStatusIcons = function () {
            const statusIcons = html.find('.status-effects');
            statusIcons.empty(); // Clear default icons

            // Now you can loop over your custom effects
            for (let effectId in customEffects) {
                const effect = customEffects[effectId];
                const isActive = actor.effects.some(e => e.name === effect.name);

                // Create an icon for each effect
                const icon = $(`<img class="status-effect" src="${effect.img}" title="${effect.name}">`);
                if (isActive) icon.addClass('active'); // Mark as active if effect is applied
                statusIcons.append(icon);

                // Add event listener for toggling the effect
                icon.on('click', async () => {
                    if (isActive) {
                        // Remove effect
                        await actor.deleteEmbeddedDocuments("ActiveEffect", actor.effects.filter(e => e.name === effect.name).map(e => e.id));
                    } else {
                        // Apply effect
                        await actor.createEmbeddedDocuments("ActiveEffect", [{
                            label: effect.name,
                            icon: effect.img,
                            duration: effect.duration,
                        }]);
                    }
                });
            }
        };

        // Call the function to update status icons
        hud.updateStatusIcons();
    } else {
        console.warn("No actor associated with token:", token.id);
    }
});

// Hook into the renderActorSheet event
	Hooks.on('renderActorSheet', (app, html, data) => {
		updateTooltips(html, app.actor);
	});

	// Function to update the tooltips
	function updateTooltips(html, actor) {
		// Retrieve all custom effects with stack counts from actor flags
		const effectFlags = actor.getFlag('emberwind', 'effects') || {};
		
		// Find elements that should display stack counts in tooltips
		html.find('[data-effect]').each((_, element) => {
			// Get the effect key from data-effect attribute
			const effectKey = element.getAttribute('data-effect');
			
			// Get the stack count from the effect flags, default to 0 if not found
			const stackCount = effectFlags[effectKey]?.stackCount || 0;
			
			// Set tooltip text with the stack count
			const tooltipText = `Stacks: ${stackCount}`;
			element.setAttribute('title', tooltipText);
		});
	}

