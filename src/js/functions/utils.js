const {
    apiKey,
    token,
    BACKLOG_LIST_NAME,
    VERBOSE,
    DEBUG,
} = require('../config');


/**
 * Get board ID from C
 */


/**
 * Retrieves all lists with specific names.
 *
 * @async
 * @function get_lists_by_names
 * @param {string} board_id - The ID of the board.
 * @param {Array<string>} list_names - Array of list names to search for.
 * @returns {Array<Object>} Array of lists that match the given names.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const get_lists_by_names = async (board_id, list_names) => {

    // Validate the input parameters
    if (!Array.isArray(list_names) || list_names.length === 0) {
        throw new Error("list_names must be a non-empty array of strings.");
    }

    // Fetch all lists from the board
    const fetchListsPromises = list_names.map(async (list_name) => {
        try {
            const response = await fetch(`https://api.trello.com/1/boards/${board_id}/lists?key=${apiKey}&token=${token}`, {
                method: 'GET'
            });

            // Wait for the response to resolve
            if (!response.ok) {
                throw new Error(`Failed to fetch lists: ${response.status} ${response.statusText}`);
            }

            const lists = await response.json();
            return lists.find(list => list.name === list_name);
        } catch (error) {
            console.error(`Error fetching list "${list_name}":`, error.message);
            return undefined;
        }
    });

    // Wait for all fetch promises to resolve
    const fetchedLists = await Promise.all(fetchListsPromises);

    return fetchedLists.filter(list => list !== undefined);
};

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
        .map(async item_1 => { return { cardName: card.name, itemName: item_1.name, checklistId: item_1.id, listId: card.idList}});
    return incomplete_items;
};


/**
 * Creates a card for a given checklist item in a list.
 *
 * @async
 * @function create_card_from_checklist_item
 * @param {string} list_id - The ID of the destination list.
 * @param {Object} checklist_item - Object of checklist item from which the backlog card will be created.
 * @returns {Object} The object for the created card.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const create_card_from_checklist_item = async (list_id, checklist_item) => {
    
    // Get the list name
    const list_response = await fetch(`https://api.trello.com/1/lists/${checklist_item.listId}/?key=${apiKey}&token=${token}`, {method: 'GET'});
    const list = await list_response.json();

    if (DEBUG) {
        console.log("list: ", list);
    }

    const listname = list.name;
    
    // Create a new card
    const response = await fetch(`https://api.trello.com/1/cards`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: `[${checklist_item.cardName}] ${checklist_item.itemName}`,
            desc: `### Card Details:\nTask: ${checklist_item.cardName}\nProject: ${listname}`,
            idList: list_id,
            pos: 'bottom',
            key: apiKey,
            token: token
        })
    })

    // Check if the response is ok
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

    // Set the custom fields for the created card
    const custom_fields = {
        'Task Name': checklist_item.cardName,
        'Task ID': checklist_item.cardId,
        'Project Name': listname,
        'Checklist Item ID': checklist_item.id,
    }

    // Set the custom fields for the created card
    const custom_fields_response = await set_custom_fields(card_id, custom_fields);

    // Check if the custom fields are set successfully
    if (custom_fields_response) {
        if (VERBOSE) {
            console.log(`Custom fields set successfully for card ${card_id}`);
        }
    } else {
        throw new Error(`Failed to set custom fields for card ${card_id}`);
    }

    return card;
}


/**
 * Updates the name of a card.
 *
 * @async
 * @function update_card_name
 * @param {string} card_id - The ID of the card.
 * @param {string} new_name - The new name for the card.
 * @returns {Promise<void>} A promise that resolves when the card name is updated.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const update_card_name = async (card_id, new_name) => {
    const response = await fetch(`https://api.trello.com/1/cards/${card_id}?name=${new_name}&key=${apiKey}&token=${token}`, {
        method: 'PUT'
    });

    if (response.ok && VERBOSE) {
        console.log(`Card name updated to ${new_name} for card ${card_id}`);
    } else {
        console.error(`Error updating card name for card ${card_id}:`, response.statusText);
    }
};


/**
 * Sets custom fields for a card.
 *
 * @async
 * @function set_custom_fields
 * @param {string} card_id - The ID of the card.
 * @param {Object} custom_fields - An object containing custom field names and their values.
 * @returns {Promise<void>} A promise that resolves when all custom fields are set.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const set_custom_fields = async (card_id, custom_fields) => {
    const custom_field_promises = Object.entries(custom_fields).map(async ([field_name, field_value]) => {
        const response = await fetch(`https://api.trello.com/1/card/${card_id}/customField/${field_name}/item?key=${apiKey}&token=${token}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                value: {
                    text: field_value
                }
            })
        });

        if (response.ok && VERBOSE) {
            console.log(`Custom field ${field_name} set to ${field_value} for card ${card_id}`);
        } else {
            console.error(`Error setting custom field ${field_name} for card ${card_id}:`, response.statusText);
        }
    });

    return Promise.all(custom_field_promises);
};


/**
 * Retrieves custom fields for a card.
 *
 * @async
 * @function get_custom_fields
 * @param {string} card_id - The ID of the card.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of custom fields.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const get_custom_fields = async (card_id) => {
    const response = await fetch(`https://api.trello.com/1/cards/${card_id}/customFieldItems?key=${apiKey}&token=${token}`, {
        method: 'GET'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch custom fields: ${response.status} ${response.statusText}`);
    }

    const custom_fields = await response.json();
    return custom_fields;
};


/**
 * Sets the description for a card.
 *
 * @async
 * @function set_card_description
 * @param {string} card_id - The ID of the card.
 * @param {string} description - The description to set for the card.
 * @returns {Promise<void>} A promise that resolves when the description is set.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const set_card_description = async (card_id, description) => {
    const response = await fetch(`https://api.trello.com/1/cards/${card_id}?desc=${description}&key=${apiKey}&token=${token}`, {
        method: 'PUT'
    });

    if (response.ok && VERBOSE) {
        console.log(`Description set for card ${card_id}`);
    } else {
        console.error(`Error setting description for card ${card_id}:`, response.statusText);
    }
}


/**
 * Deletes a card by card ID.
 *
 * @async
 * @function delete_card
 * @param {string} card_id - The ID of the card to delete.
 * @returns {Promise<void>} A promise that resolves when the card is deleted.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
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


/**
 * Deletes all cards in given lists.
 *
 * @async
 * @function delete_all_cards_in_lists
 * @param {Array<string>} list_ids - Array of list IDs whose cards need to be deleted.
 * @returns {Promise<Array<string>>} A promise that resolves to an array of names of deleted cards.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
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


/**
 * Handles checklist item creation.
 * 
 * @async
 * @function handle_checklist_item_creation
 * 
 */
const handle_checklist_item_creation = async (action_data) => {
    console.log("createCheckItem: Checklist item created:", action_data.checkItem);

    // Get the card ID and board ID
    const board_id = action_data.board.id;
    console.log("createCheckItem: New Checklist item Board ID:", board_id);

    const checklist_card_id = action_data.card.id;
    console.log("createCheckItem: New Checklist item Card ID:", checklist_card_id);

    const backlog_list = await get_lists_by_names(board_id, [BACKLOG_LIST_NAME]);
    console.log("createCheckItem: New Checklist item Backlog List:", backlog_list);
    const backlog_list_id = backlog_list[0].id;

    console.log("createCheckItem: New Checklist item Card ID:", checklist_card_id);
    console.log("createCheckItem: New Checklist item Backlog List ID:", backlog_list_id);
    
    // Get the card details
    const new_card = await create_card_from_checklist_item(backlog_list_id, checklist_item);
    if (new_card) {
        console.log("New card created from checklist item:", new_card.name);
    } else {
        console.log("Failed to create card from checklist item:", checklist_item.name);
    }

    return card;
}

module.exports = {
    get_lists_by_names,
    get_cards_in_lists,
    get_incomplete_checklist_items,
    create_card_from_checklist_item,
    update_card_name,
    set_custom_fields,
    get_custom_fields,
    set_card_description,
    delete_card,
    delete_all_cards_in_lists,
    handle_checklist_item_creation,
};
