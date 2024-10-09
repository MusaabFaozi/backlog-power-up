
const {
    apiKey,
    token,
    VERBOSE,
    DEBUG,
} = require('../config');

// Get all cards in certain lists
const get_cards_in_lists = async (list_ids) => {
    const cards = [];
    
    for (const list_id of list_ids) {
        const response = await fetch(`https://api.trello.com/1/lists/${list_id}/cards?key=${apiKey}&token=${token}`, {
            method: 'GET'
        });
        
        if (response.ok) {
            const list_cards = await response.json();
            cards.push(...list_cards);
        } else {
            console.error(`Error retrieving cards from list ${list_id}:`, response.statusText);
        }
    }
    
    return cards;
};


// Function to get all incomplete checklist items in a given card
const get_incomplete_checklist_items = async (card) => {
    const response = await fetch(`https://api.trello.com/1/cards/${card.id}/checklists?key=${apiKey}&token=${token}`, {method: 'GET'});
    
    if (!response.ok) {
        throw new Error(`Failed to fetch checklists: ${response.status} ${response.statusText}`);
    }

    const checklists = await response.json();
    const incomplete_items = checklists.flatMap(checklist => checklist.checkItems)
        .filter(item => item.state === 'incomplete')
        .map(async item_1 => { return { cardName: card.name, itemName: item_1.name, checklistId: item_1.id, idList: card.idList}});
    return incomplete_items;
};


const create_card_from_checklist_item = async (t, list_id, checklist_item) => {
    const response = await fetch(`https://api.trello.com/1/cards`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: `[${checklist_item.cardName}] ${checklist_item.itemName}`,
            desc: `Originally from card: ${checklist_item.cardName}\nOriginally from List ID: ${checklist_item.idList}`,
            idList: list_id,
            pos: 'bottom',
            key: apiKey,
            token: token
        })
    })

    if (!response.ok) {
        throw new Error(`Failed to create card: ${response.status} ${response.statusText}`);
    }
    
    const card = await response.json();

    if (DEBUG) {
        console.log("card: ", card);
    }

    const card_id = card.id;

    if (VERBOSE) {
        console.log(`Created a new card with id: ${card_id}`);
    }

    t.set('card', 'shared', {
        checklist_item_id: checklist_item.id
    });

    return card;
}


// Function to delete a card by card id
const delete_card = async (card_id) => {
    const response = await fetch(`https://api.trello.com/1/cards/${card_id}?key=${apiKey}&token=${token}`, {
      method: 'DELETE'
    });
    
    if (response.ok && VERBOSE) {
      console.log(`Card ${card_id} deleted successfully`);
    } else {
      console.error(`Error deleting card ${card_id}:`, response.statusText);
    }
};


// Function to delete all cards in given lists
const delete_all_cards_in_lists = async (list_ids) => {
    const cards_to_delete = await get_cards_in_lists(list_ids);
    
    const card_delete_promises = cards_to_delete.map(async card => {
        await delete_card(card.id);
        return card.name;
    });
    
    if (DEBUG) {
        console.log("card_delete_promises: ", card_delete_promises);
    }

    return Promise.all(card_delete_promises);
};


module.exports = {
    get_cards_in_lists,
    get_incomplete_checklist_items,
    create_card_from_checklist_item,
    delete_card,
    delete_all_cards_in_lists,
};