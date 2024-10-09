require('dotenv').config();
const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;

// Settings config
const BACKLOG_LIST_NAME = "backlog";
const WIP_LISTS = ["today's tasks"];
const DONE_LISTS = ["done today!"];
var VERBOSE = true;
const DEBUG = true;
if (DEBUG) {
    VERBOSE = DEBUG;
}


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
            desc: `Originally from card: ${checklist_item.cardName} in ${checklist_item.idList}`,
            idList: list_id,
            pos: 'bottom',
            key: apiKey,
            token: token
        })
    })

    if (!response.ok) {
        throw new Error(`Failed to create card: ${response.status} ${response.statusText}`);
    }
    
    const card = response.json();
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


const backlog_all = async (t) => {

    const lists = await t.lists('all');

    const backlog_list = lists.find(list => list.name.toLowerCase() === BACKLOG_LIST_NAME);
    if(!backlog_list) {
        return t.popup({
            title: 'Error',
            items: [
                { text: 'Backlog list is not found on this board.', callback: function(t) { return t.closePopup(); } }
            ]
        });
    }

    const backlog_list_id = backlog_list.id;
    const wip_list_ids = lists
        .filter(list => WIP_LISTS.includes(list.name.toLowerCase()))
        .map(list => list.id);
    const done_list_ids = lists
        .filter(list => DONE_LISTS.includes(list.name.toLowerCase()))
        .map(list => list.id);
    
    if (DEBUG) {
        console.log("backlog_list_id: ", backlog_list_id);
        console.log("wip_list_ids: ", wip_list_ids);
        console.log("done_list_ids: ", done_list_ids);
    }

    // Delete existing cards before backlogging cards
    const combined_init_list_ids = [backlog_list_id, ...wip_list_ids];
    console.log("combined_init_list_ids: ", combined_init_list_ids);
    delete_all_cards_in_lists(combined_init_list_ids);

    const cards = await t.cards('all');
    
    // Filter out backlog and auxiliary cards
    if (DEBUG) {
        console.log("cards: ", cards);
    }

    const relevant_cards = cards.filter(card => card.idList !== backlog_list_id 
        && !wip_list_ids.includes(card.idList) && !done_list_ids.includes(card.idList));
    
    if (DEBUG) {
        console.log("relevant_cards: ", relevant_cards);
    }

    const card_checklist_promises = relevant_cards.map(async card => {
        return get_incomplete_checklist_items(card);
    });

    if (DEBUG) {
        console.log("card_checklist_promises: ", card_checklist_promises);
    }

    const all_incomplete_items = await Promise.all(card_checklist_promises);
    const incomplete_checklist_items = all_incomplete_items.flat(); // Flatten the array of checklist items

    if (DEBUG) {
        console.log("incomplete_checklist_items: ", incomplete_checklist_items);
    }

    // Create a new card in the Backlog for each incomplete checklist item
    const create_card_promises = incomplete_checklist_items.map(async checklist_item => {
        console.log("checklist_item: ", checklist_item);
        return create_card_from_checklist_item(t, backlog_list_id, checklist_item);
    });

    if (DEBUG) {
        console.log("create_card_promises:", create_card_promises);
    }

    // Wait for all cards to be created
    return Promise.all(create_card_promises).then(function() {
        return t.popup({
            title: 'Success',
            items: [
            { text: `Created ${incomplete_checklist_items.length} cards in ${BACKLOG_LIST_NAME} for incomplete items.`, callback: function(t) { return t.closePopup(); }}
            ]
        });
    });
}

window.TrelloPowerUp.initialize({
    "board-buttons": function(t, options) {
        return [{
            icon: "https://cdn-icons-png.flaticon.com/512/5360/5360758.png",
            text: "Backlog All!",
            callback: function (t) {
                return backlog_all(t)
            }
        }];
    }
});