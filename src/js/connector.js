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

const {get_incomplete_checklist_items,
    create_card_from_checklist_item,
    delete_all_cards_in_lists,
} = require('./functions/utils');


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

    const all_incomplete_items = await Promise.all(
        relevant_cards.map(async card => {
            const card_checklist_promises = await get_incomplete_checklist_items(card);

            if (DEBUG) {
                console.log("card_checklist_promises: ", card_checklist_promises);
            }

            return await Promise.all(card_checklist_promises);
        })
    );

    const incomplete_checklist_items = all_incomplete_items.flat(); // Flatten the array of checklist items

    if (DEBUG) {
        console.log("incomplete_checklist_items: ", incomplete_checklist_items);
    }

    // Create a new card in the Backlog for each incomplete checklist item
    const create_card_promises = incomplete_checklist_items.map(checklist_item => {
        console.log("checklist_item: ", checklist_item.cardName);
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