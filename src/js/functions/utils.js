const {
    apiKey,
    token,
    BACKLOG_LIST_NAME,
    VERBOSE,
    DEBUG,
} = require('../config');


/**
 * 
 * @async
 * @function get_board_backlog_list_id
 * @description Retrieves the ID of the backlog list for a given board.
 * @param {string} board_id - The ID of the board.
 * @returns {string} The ID of the backlog list.
 * @throws {Error} If the board ID is not provided or if the list is not found.
 */
const get_board_backlog_list_id = async (board_id) => {

    // Validate the input parameters
    if (!board_id) {
        throw new Error("board_id must be provided.");
    }

    // Fetch all lists from the board
    const backlog_list = await get_lists_by_names(board_id, [BACKLOG_LIST_NAME]);
    if (backlog_list.length === 0) {
        throw new Error(`No list found with the name "${BACKLOG_LIST_NAME}" on board ${board_id}.`);
    }

    const backlog_list_id = backlog_list[0].id;
    if (DEBUG) {
        console.log("backlog_list_id: ", backlog_list_id);
    }

    return backlog_list_id;
}

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
            return lists.find(list => list.name.toLowerCase() === list_name);
        } catch (error) {
            console.error(`Error fetching list "${list_name}":`, error.message);
            return undefined;
        }
    });

    // Wait for all fetch promises to resolve
    const fetchedLists = await Promise.all(fetchListsPromises);

    return fetchedLists.filter(list => list !== undefined);
};


/**
 * @async
 * @function get_cards_in_lists
 * @description Retrieves all cards in the specified lists.
 * @param {Array} list_ids - Array of list IDs to retrieve cards from.
 * @returns cards - Array of cards from the specified lists.
 */
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


/**
 * @async
 * @function get_list_from_card_id
 * @description Retrieves the list object from a given card ID.
 * @param {string} card_id - The ID of the card. 
 * @returns 
 */
const get_list_from_card_id = async (card_id) => {

    // Validate the input parameters
    if (!card_id) {
        throw new Error("card_id must be provided.");
    }

    // Fetch the card details
    const card_response = await fetch(`https://api.trello.com/1/cards/${card_id}/?key=${apiKey}&token=${token}`, {
        method: 'GET'
    });
    
    // Retrieve the list ID from the card response
    var list_id = null;
    if (card_response.ok) {
        const card = await card_response.json();
        list_id = card.idList;
    } else {
        console.error(`Error retrieving list from card ${card_id}:`, card_response.statusText);
        return null;
    }

    // Fetch the list details using the list ID
    const list_response = await fetch(`https://api.trello.com/1/lists/${list_id}/?key=${apiKey}&token=${token}`, {
        method: 'GET'
    });

    if (list_response.ok) {
        const list = await list_response.json();
        return list;
    } else {
        console.error(`Error retrieving list ${list_id}:`, list_response.statusText);
        return null;
    }
}

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
 * @function backlog_checklist_item
 * @param {string} card_id - The ID of the Check Item source Card.
 * @param {Object} checklist_item - Object of checklist item from which the backlog card will be created.
 * @returns {Object} The object for the created card.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const backlog_checklist_item = async (card_id, checklist_item) => {

    // Validate the input parameters
    if (!card_id || !checklist_item) {
        throw new Error("card_id and checklist_item must be provided.");
    }

    if (DEBUG) {
        console.log("checklist_item: ", checklist_item);
    }
    
    // Get the source Card details
    const card_response = await fetch(`https://api.trello.com/1/cards/${card_id}?key=${apiKey}&token=${token}`, {
        method: 'GET'
    });

    if (!card_response.ok) {
        throw new Error(`Failed to fetch card details: ${card_response.status} ${card_response.statusText}`);
    }
    const source_card = await card_response.json();

    // Unpack the card details
    const card_name = source_card.name;
    const board_id = source_card.idBoard;

    // Get the backlog list ID
    const backlog_list_id = await get_board_backlog_list_id(board_id);
    if (!backlog_list_id) {
        throw new Error(`Failed to fetch backlog list ID for board ${board_id}`);
    }

    // Get the list name
    const list = await get_list_from_card_id(card_id);
    if (!list) {
        throw new Error(`Failed to fetch list for card ${card_id}`);
    }
    
    const list_name = list.name;
    
    // Create a new card
    const response = await fetch(`https://api.trello.com/1/cards`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: `[${card_name}] ${checklist_item.name}`,
            desc: `### Card Details:\nTask: ${card_name}\nProject: ${list_name}`,
            idList: backlog_list_id,
            pos: 'bottom',
            key: apiKey,
            token: token
        })
    })

    // Check if the response is ok
    if (!response.ok) {
        throw new Error(`Failed to create card: ${response.status} ${response.statusText}`);
    }
    const backlog_card = await response.json();

    if (DEBUG) {
        console.log("card: ", backlog_card);
    }

    const backlog_card_id = backlog_card.id;

    if (VERBOSE) {
        console.log(`Created a new card with id: ${backlog_card_id}`);
    }

    // Set the custom fields for the created card
    const custom_fields = {
        'Task Name': card_name,
        'Task ID': card_id,
        'Project Name': list_name,
        'Checklist Item ID': checklist_item.id,
    }

    // Set the custom fields for the created card
    const custom_fields_response = await set_custom_fields(backlog_card_id, custom_fields);

    // Check if the custom fields are set successfully
    if (custom_fields_response) {
        if (VERBOSE) {
            console.log(`Custom fields set successfully for card ${backlog_card_id}`);
        }
    } else {
        throw new Error(`Failed to set custom fields for card ${backlog_card_id}`);
    }

    // DEBUG ONLY
    if (DEBUG) {
        const check_custom_fields = await get_custom_fields(backlog_card_id);
        console.log("check_custom_fields: ", check_custom_fields);
    }

    return backlog_card;
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
 * @param {Object} action_data - The action data containing the checklist item, card, and board details.
 * 
 */
const handle_checklist_item_creation = async (action_data) => {

    // Unpack the action data
    const card_id = action_data.card.id;
    const checklist_item = action_data.checkItem;

    // Check if the checklist item is already complete
    if (checklist_item.state === 'complete') {
        console.log("Checklist item is complete:", checklist_item.name);
        return;
    }

    const card = await backlog_checklist_item(card_id, checklist_item);
    if (card) {
        console.log("New card created from checklist item:", card.name);
    } else {
        console.log("Failed to create card from checklist item:", checklist_item.name);
    }

    return card;
}

module.exports = {
    get_lists_by_names,
    get_cards_in_lists,
    get_incomplete_checklist_items,
    backlog_checklist_item,
    update_card_name,
    set_custom_fields,
    get_custom_fields,
    set_card_description,
    delete_card,
    delete_all_cards_in_lists,
    handle_checklist_item_creation,
};
