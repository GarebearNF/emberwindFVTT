export class TextEnricher {
    static async enrichText(text, context) {
        const actor = context.getRollData ? context : context.actor; // Check if context is the item or actor
        console.log("Enriching text:", text);
        return await TextEditor.enrichHTML(text, {
            secrets: true,
            documents: true,
            links: true,
            rolls: true,
            async: true,
            rollData: actor.getRollData ? actor.getRollData() : {} // Safely access roll data
        });
    }
}

export class ItemTextEnricher {
    static async enrichText(text, itemId) {
        // Try to fetch the item globally
        let item = await fromUuid(itemId);
        
        // If not found, check if it's associated with an actor
        if (!item) {
            console.warn(`Item not found for UUID: ${itemId}`);
            return text; // Return the original text if item is not found
        }

        // Enrich the text using the item's data
        return await TextEditor.enrichHTML(text, {
            secrets: item.actor.isOwner,  // Access the owning actor
            documents: true,
            links: true,
            rolls: true,
            async: true,
            rollData: item.getRollData()   // Get roll data from the item
        });
    }
}