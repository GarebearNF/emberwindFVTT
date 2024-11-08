import { TextEnricher } from '../apps/TextEnricher.mjs';

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class EmberItem extends Item {
	
	async getData() {
        const context = await super.getData();
        context.enrichedDescription = await TextEnricher.enrichText(this.item.system.description, this.item);
        context.enrichedEffect = await TextEnricher.enrichText(this.item.system.effect, this.item);
        // Add more fields as needed
        return context;
    }
	
	chatTemplate = {
	  "ability": "systems/emberwind/templates/chat/item-roll.hbs"
  };
  
  
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
	
	const  itemData = this;
	const  data = itemData.system;

	if (data.effect) {
		data.description = data.effect;
	};

	if (this.actor) {
		const actorData = this.actor;
		const aData = actorData.system;
		const tier = aData.tier;
		const itemtier = data.tier
		
		data.tiermod = Number(tier);
		data.itemtiermod = Number(tier)+1;
	};
	
	if (itemData.type === "class" && this.actor) {
		const actorData = this.actor;
		const aData = actorData.system;
		
		aData.class = String(this.name);
		data.disable = true;
	};
	
	if (itemData.type === "subclass" && this.actor) {
		const actorData = this.actor;
		const aData = actorData.system;
		
		aData.subclass = String(this.name);
		data.disable = "true";
	};
	
	if (itemData.type === "class-action") {
		if (data.dice !== "") {
			const num = data.itemtiermod.toString();
			data.formula = num.concat(data.dice);
		};
		data.classification = "Action";
	};
	
	if (itemData.type === "class-trait") {
		
		data.classification = "Trait";
	};
	
	if (itemData.type === "class-tt-action") {
		data.classification = "Tide-Turner";
	};
	
	if (itemData.type === "maneuver") {
		
		data.classification = "Maneuver";
	};
	
	if (itemData.type === "item") {
		if (data.type === "Melee") {
			data.combat.melee.dnum = data.itemtiermod;
			data.combat.melee.dice = data.dice;
			const num = data.combat.melee.dnum.toString();
			if (data.combat.melee.bonus !== 0) {
				data.formula = num.concat(data.combat.melee.dice,"+",data.combat.melee.bonus);
			} else {
				data.formula = num.concat(data.combat.melee.dice);
			}
		};
		if (data.type === "Ranged") {
			data.combat.ranged.dnum = data.itemtiermod;
			data.combat.ranged.dice = data.dice;
			const num = data.combat.ranged.dnum.toString();
			if (data.combat.melee.bonus !== 0) {
				data.formula = num.concat(data.combat.ranged.dice,"+",data.combat.ranged.bonus);
			} else {
				data.formula = num.concat(data.combat.ranged.dice);
			}
		};
		 		
		data.classification = "Item";
	};
	
  }

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with `this.system`
    const rollData = { ...super.getRollData() };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;
    const actor = this.actor;
	const itemId = `Actor.${actor._id}.Item.${item._id}`

    // Check if actor is defined
    if (!actor) {
        console.error("Actor is undefined");
        return; // Exit early if there's no actor
    }

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
        ChatMessage.create({
            speaker: speaker,
            rollMode: rollMode,
            flavor: label,
            content: item.system.description ?? '',
        });
    } else {
        // Retrieve roll data.
        const rollData = this.getRollData();
		const roll = new Roll('1d20', rollData);
        await roll.evaluate();
		if (game.dice3d) {
			// Use Dice So Nice to show the roll with the maximized result
			await game.dice3d.showForRoll(roll, game.user, true); // true enables visualization
		}
        const rollResult = roll.total;

        // Extracting results with die types
        const dieResults = roll.terms.flatMap(term => {
			if (term instanceof foundry.dice.terms.Die) {
				return term.results.map(result => ({
					type: term.faces,
					result: result.result
				}));
			}
			return [];
		});

        // Construct tooltip content
        const tooltipContent = dieResults.map(({ type, result }) => {
            return `<span class="roll die d${type}">${result}</span>`;
        });

        // Join the results
        const tooltipString = tooltipContent.join(' ');

        // Enrich descriptions and effects
        const enrichedDescription = await TextEnricher.enrichText(item.system.description, item);
        const enrichedEffect = await TextEnricher.enrichText(item.system.effect, item);
        
        // Status evaluations
        let critStatus = (rollResult > actor.system.abilities.crit.value && !item.system["auto-crit"]) ? 'Fail' : 'Success';
		let accuStatus = (rollResult > actor.system.abilities.accu.value && !item.system["auto-hit"]) ? 'Fail' : 'Success';
        let peneStatus = (rollResult > actor.system.abilities.pene.value && !item.system.pierce) ? 'Fail' : 'Success';
		if (critStatus === 'Success') {
			accuStatus = 'Crit';
			peneStatus = 'Crit';
		}
		

        // Debugging logs
        console.log(`Crit Status: ${critStatus}`);
        console.log(`Accu Status: ${accuStatus}`);
        console.log(`Pene Status: ${peneStatus}`);

        const templateData = {
            actor: this.actor,
            item: this,
            effects: this.effects,
            labels: this.labels,
            enrichedEffect: enrichedEffect,
            enrichedDescription: enrichedDescription,
            critStatus: critStatus,
            accuStatus: accuStatus,
            peneStatus: peneStatus,
            rollResult: roll.total,
            tooltipFinal: tooltipString,
			rollFormula: roll.formula
        };

        const html = await renderTemplate("systems/emberwind/templates/chat/item-roll.hbs", templateData);

        // Create the chat message
        await ChatMessage.create({
            content: html,
            speaker: speaker,
			flags: { itemId }, // Store item ID in flags for later use
        });
    }
}

}
