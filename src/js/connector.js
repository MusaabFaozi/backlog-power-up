require('dotenv').config();
const apiKey = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_BACKLOG_TOKEN;

// Settings config
const BACKLOG_LIST_NAME = "backlog";
const WIP_LISTS = ["today's tasks"];
const DONE_LISTS = ["done today!"];


var backlog_all = function(t) {

    return t.lists('all')
    .then(function(lists) {

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

        // Retrieve all cards
        return t.cards('all').then(function(cards) {
            // Filter out backlog and auxiliary cards
            console.log("cards: ", cards);
            const relevant_cards = cards.filter(card => card.idList !== backlog_list_id 
                && !wip_list_ids.includes(card.idList) && !done_list_ids.includes(card.idList));
            console.log("relevant_cards: ", relevant_cards);

            const card_checklist_promises = relevant_cards.map(async card => {
                const response = await fetch(`https://api.trello.com/1/cards/${card.id}/checklists?key=${apiKey}&token=${token}`);
                const checklists = await response.json();
                const incomplete_items = checklists.flatMap(checklist => checklist.checkItems)
                    .filter(item => item.state === 'incomplete')
                    .map(item_1 => ({ cardName: card.name, itemName: item_1.name }));
                return incomplete_items;
              });
  
            console.log("card_checklist_promises: ", card_checklist_promises);

            // Wait for all checklist data to be retrieved
            return Promise.all(card_checklist_promises).then(function(all_incomplete_items) {
                const incomplete_checklist_items = all_incomplete_items.flat(); // Flatten the array of checklist items
  
                // Create a new card in the Backlog for each incomplete checklist item
                const create_card_promises = incomplete_checklist_items.map(item => {
                  return fetch(`https://api.trello.com/1/cards`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      name: `[${item.cardName}] ${item.itemName}`,
                      desc: `Originally from card: ${item.cardName} in ${item.idList}`,
                      idList: backlog_list_id,
                      pos: 'top',
                      key: apiKey,
                      token: token
                    })
                  }).then(response => response.json()).then(card => {
                        const card_id = card.id;

                        console.log(`Created a new card with id: ${card_id}`);
                        t.set('card', 'shared', {
                            checklist_item_id: item.id
                        })
                    });
                });
  
                // Wait for all cards to be created
                return Promise.all(create_card_promises).then(function() {
                    return t.popup({
                        title: 'Success',
                        items: [
                        { text: `Created ${incomplete_checklist_items.length} cards in ${BACKLOG_LIST_NAME} for incomplete items.`, callback: function(t) { return t.closePopup(); }}
                        ]
                    });
                });
            });
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