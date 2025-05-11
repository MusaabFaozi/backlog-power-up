const {
    apiKey,
    token,
    BACKLOG_LIST_NAME,
    META_DATA_REGEX,
    VERBOSE,
    DEBUG,
    WIP_LISTS,
    DONE_LISTS,
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
    if (!board_id) {
        throw new Error("board_id must be provided.");
    }

    if (!Array.isArray(list_names) || list_names.length === 0) {
        throw new Error("list_names must be a non-empty array of strings.");
    }

    console.log("Fetching lists for board:", board_id);
    console.log("List names to search for:", list_names);

    try {
        // Fetch all lists from the board
        const response = await fetch(`https://api.trello.com/1/boards/${board_id}/lists?key=${apiKey}&token=${token}`, {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch lists: ${response.status} ${response.statusText}`);
        }

        const lists = await response.json();
        console.log("Fetched lists:", lists);

        // Filter the lists to match the provided names (case-insensitive)
        const matchedLists = list_names.map((list_name) => {
            const matchedList = lists.find((list) => list.name.toLowerCase() === list_name.toLowerCase());
            if (!matchedList) {
                console.warn(`List not found: ${list_name}`);
            }
            return matchedList;
        });

        // Filter out undefined values (lists that were not found)
        const filteredLists = matchedLists.filter((list) => list !== undefined);
        console.log("Matched lists:", filteredLists);

        return filteredLists;
    } catch (error) {
        console.error("Error in get_lists_by_names:", error.message);
        return [];
    }
};


/**
 * @async
 * @function get_cards_in_lists
 * @description Retrieves all cards in the specified lists.
 * @param {Array} list_ids - Array of list IDs to retrieve cards from.
 * @returns cards - Array of cards from the specified lists.
 */
const get_cards_in_lists = async (list_ids) => {

    // Validate the input parameters
    if (!Array.isArray(list_ids) || list_ids.length === 0) {
        throw new Error("list_ids must be a non-empty array of strings.");
    }

    let cards = [];
    
    // Fetch all cards from the lists
    const fetchPromises = list_ids.map(async (list_id) => {
        const response = await fetch(`https://api.trello.com/1/lists/${list_id}/cards?key=${apiKey}&token=${token}`, {
            method: 'GET'
        });

        if (response.ok) {
            const list_cards = await response.json();
            cards.push(...list_cards);
        } else {
            console.error(`Error retrieving cards from list ${list_id}:`, response.statusText);
        }
    });

    // Wait for all fetch promises to resolve
    await Promise.all(fetchPromises);

    return cards;
};


/**
 * @async
 * @function get_list_from_card_id
 * @description Retrieves the list object from a given card ID.
 * @param {string} card_id - The ID of the card. 
 * @returns {Object} The list object associated with the card.
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
    let list_id = null;
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
        .map(async item_1 => { return { cardName: card.name, name: item_1.name, idCard: card.id, checklistId: item_1.id, listId: card.idList}});
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
    console.log("card_id: ", card_id);
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
            pos: 'top',
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

    // Set the meta data for the created card
    const meta_data = {
        'TaskName': card_name,
        'TaskID': card_id,
        'ProjectName': list_name,
        'CheckItemID': checklist_item.id,
    }

    // Set the meta data for the created card
    const meta_data_response = await set_meta_data(backlog_card_id, meta_data);

    // Check if the meta data are set successfully
    if (meta_data_response) {
        if (VERBOSE) {
            console.log(`Meta data set successfully for card ${backlog_card_id}`);
        }
    } else {
        throw new Error(`Failed to set meta data for card ${backlog_card_id}`);
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
    return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch(`https://api.trello.com/1/cards/${card_id}?name=${new_name}&key=${apiKey}&token=${token}`, {
                method: 'PUT'
            });

            if (response.ok) {
                if (VERBOSE) {
                    console.log(`Card name updated to ${new_name} for card ${card_id}`);
                }
                resolve();
            } else {
                console.error(`Error updating card name for card ${card_id}:`, response.statusText);
                reject(new Error(`Failed to update card name: ${response.statusText}`));
            }
        } catch (error) {
            console.error(`Error updating card name for card ${card_id}:`, error.message);
            reject(error);
        }
    });
};


/**
 * Sets Meta data for a card.
 *
 * @async
 * @function set_meta_data
 * @param {string} card_id - The ID of the card.
 * @param {Object} meta_data - An object containing meta meta data names and their values.
 * @returns {Promise<boolean>} A promise that resolves to true if the operation was successful, false otherwise.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const set_meta_data = (card_id, meta_data) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Validate the input parameters
            if (!card_id || !meta_data) {
                throw new Error("card_id and meta_data must be provided.");
            }

            const card_response = await fetch(`https://api.trello.com/1/cards/${card_id}?key=${apiKey}&token=${token}`);
            if (!card_response.ok) {
                throw new Error(`Failed to fetch card details: ${card_response.status} ${card_response.statusText}`);
            }
            const card = await card_response.json();

            // Get card description
            const card_desc = card.desc || '';

            // Delete the existing meta data from the card description if it exists
            let updated_desc = card_desc.replace(META_DATA_REGEX, '');

            // Encode the meta data as a JSON string in base64 format
            const encoded_meta_data = btoa(JSON.stringify(meta_data));

            // Add the new meta data to the card description
            updated_desc += `\n\n\n<!-- Meta Data: {${encoded_meta_data}} -->`;

            if (DEBUG) {
                console.log("updated_desc: ", updated_desc);
            }

            const response = await set_card_description(card_id, updated_desc);

            if (DEBUG) {
                console.log("set_card_description response: ", response);
            }

            resolve(response.ok);
        } catch (error) {
            console.error("Error in set_meta_data:", error.message);
            reject(error);
        }
    });
};


/**
 * Retrieves meta data for a card.
 *
 * @function get_meta_data
 * @param {string} card - The card containing the description with meta data.
 * @returns {Promise<Array<Object>>} A promise that resolves to an Object of meta data.
 * @throws {Error} If the request fails or the response is not 'ok'.
 */
const get_meta_data = function (card) {

    if (!card) {
        throw new Error(`Failed to fetch card details: ${response.status} ${response.statusText}`);
    }

    const meta_data_match = card.desc.match(META_DATA_REGEX);
    if (!meta_data_match) {
        return null; // No meta data found
    }

    const encoded_meta_data = meta_data_match[0].substring(
        meta_data_match[0].indexOf('{') + 1,
        meta_data_match[0].indexOf('}')
    );

    const meta_data = JSON.parse(atob(encoded_meta_data));

    if (DEBUG) {
        console.log("meta_data: ", meta_data);
    }

    return meta_data;
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
const set_card_description = (card_id, description) => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch(`https://api.trello.com/1/cards/${card_id}?key=${apiKey}&token=${token}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ desc: description })
            });

            if (response.ok) {
                if (VERBOSE) {
                    console.log(`Description set for card ${card_id}`);
                }
                resolve(response);
            } else {
                console.error(`Error setting description for card ${card_id}:`, response.statusText);
                reject(new Error(`Failed to set description: ${response.statusText}`));
            }
        } catch (error) {
            console.error(`Error setting description for card ${card_id}:`, error.message);
            reject(error);
        }
    });
};


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


////////////////////////////////
// Webhook Handlers
////////////////////////////////

/**
 * Handles checklist item creation.
 * 
 * @async
 * @function handle_checklist_item_creation
 * @param {Object} action_data - The action data containing the checklist item and source card details.
 * @returns {Promise<Object>} The created card object.
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


/**
 * Handles source card name change.
 * 
 * @async
 * @function handle_source_card_name_change
 * @param {Object} action_data - The action data containing the card and board details.
 */
const handle_source_card_name_change = async (action_data) => {

    // if (DEBUG) {
    //     console.log("action_data old: ", action_data.old);
    //     console.log("action_data card: ", action_data.card);
    //     console.log("action_data board: ", action_data.board);
    //     console.log("action_data: ", action_data);
    // }

    // Unpack the action data
    const source_card_id = action_data.card.id;
    const new_source_card_name = action_data.card.name;
    const old_source_card_name = action_data.old.name;
    const board_id = action_data.board.id;
    const source_card_list = action_data.list;

    // Check if the card is in a default list
    const defaultlist_names = [BACKLOG_LIST_NAME, ...WIP_LISTS, ...DONE_LISTS];
    const defaultlists = await get_lists_by_names(board_id, defaultlist_names);
    const defaultlists_ids = defaultlists.map(list => list.id);

    // Get cards in default lists
    const checklist_cards = await get_cards_in_lists(defaultlists_ids);

    // Check if the card is not in a default list
    if (DEBUG) {
        console.log("defaultlists_ids: ", defaultlists_ids);
        console.log("source_card_list: ", source_card_list);
    }
    if (!defaultlists_ids.includes(source_card_list.id)) {
        if (DEBUG) {
            console.log("Card is not in a default list:", source_card_list.name, ". Proceeding to update checklist items.");
        }

        await Promise.all(checklist_cards.map(async (checklist_card) => {
            if (checklist_card.name.includes(old_source_card_name)) {

            // Retrieve meta data for the card
            const meta_data = get_meta_data(checklist_card);
            
            // Check if Task ID equals the card ID
            if (meta_data) {
                const task_id = meta_data.find(field => field.name === "TaskID");
                console.log("task_id: ", task_id);
                console.log("source_card_id: ", source_card_id);
                if (task_id && task_id.value === source_card_id) {

                // Create promises for updating the checklist card
                const updateNamePromise = (async () => {
                    const new_name = checklist_card.name.replace(old_source_card_name, new_source_card_name);
                    await update_card_name(checklist_card.id, new_name);
                    if (VERBOSE) {
                    console.log("Checklist card name successfully updated:", new_name);
                    }
                })();

                const updateDescriptionPromise = (async () => {
                    const new_desc = `### Card Details:\nTask: ${new_source_card_name}\nProject: ${source_card_list.name}`;
                    await set_card_description(checklist_card.id, new_desc);
                    if (DEBUG) {
                    console.log("Checklist card description successfully updated:", new_desc);
                    }
                })();

                const updateMetaDataPromise = (async () => {
                    const new_meta_data = {
                    'TaskName': new_source_card_name,
                    'TaskID': source_card_id,
                    'ProjectName': source_card_list.name,
                    'CheckItemID': meta_data.find(field => field.name === "CheckItemID").value,
                    };
                    await set_meta_data(checklist_card.id, new_meta_data);
                    if (DEBUG) {
                    console.log("Meta data successfully updated for checklist card:", checklist_card.id);
                    }
                })();

                // Wait for all promises to resolve
                await Promise.all([updateNamePromise, updateDescriptionPromise, updateMetaDataPromise]);
                }
            }
            }
        }));
    }

    return;
}


module.exports = {
    get_lists_by_names,
    get_cards_in_lists,
    get_list_from_card_id,
    get_board_backlog_list_id,
    get_incomplete_checklist_items,
    backlog_checklist_item,
    update_card_name,
    set_meta_data,
    get_meta_data,
    set_card_description,
    delete_card,
    delete_all_cards_in_lists,

    // Webhook Handlers
    handle_checklist_item_creation,
    handle_source_card_name_change,
};
