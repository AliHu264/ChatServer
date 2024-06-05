let ws;
let inRoom = false;
let currentRoomCode = null
let userNamed = false;

//function called when Create New Room button is pressed
function newRoom() {
    //emptying the chat log for this client since they are joining a different room
    document.getElementById("log").value = "";

    // calling the ChatServlet to retrieve a new room ID
    let callURL = "http://localhost:8080/WSChatServer-1.0-SNAPSHOT/chat-servlet";
    fetch(callURL, {
        method: 'GET',
        headers: {
            'Accept': 'text/plain',
        },
    })
        .then(response => response.text())
        .then(response => enterRoom(response.trim()));
        //calling enterRoom() refreshes the list of rooms, no need to do it here
        // .then(response => {
        //     // Appends the new list item directly to the ul.nav
        //     document.querySelector(".nav").innerHTML += ` <li><button onclick="enterRoom('${response.trim()}')">${response.trim()}</button></li>`;
        // });
}

//Function called when the user presses one of the room buttons to enter it (is also called when creating a new room)
function enterRoom(code) {

    //alert the user then do nothing if they are alreading in this room
    if (code === currentRoomCode){
        alert("You are already in room " + code);
        return;
    }else{
        currentRoomCode = code;
    }


    //emptying the chat log since they are joining a different room
    document.getElementById("log").innerHTML = "";


    // refresh the list of rooms
    refreshRooms();

    //leave previous room if client is in one.
    if(inRoom){ //if in room
        ws.close(); //close socket (leaving old chat room)

        //remove existing event listeners on "input", hoping this stops the blank chat messages
        //removeEventListener(type, listener)
        document.getElementById("input").removeEventListener("keyup", handleKeyInput);
        //remove existing event listeners on "status-input"
        document.getElementById("status-input").removeEventListener("keyup", sendStatusMessage);

    }

    inRoom = true;


    // create the web socket
    ws = new WebSocket("ws://localhost:8080/WSChatServer-1.0-SNAPSHOT/ws/" + code);


    // parse messages received from the server and update the UI accordingly
    ws.onmessage = function (event) {
        console.log("data from websocket: " + event.data);

        // parsing the server's message as json
        let message = JSON.parse(event.data);

        // handle message
        handleMessage(message);
    }

    //handleKeyInput is a function defined in this file. It's just what should happen if the user hits any key while in input
    document.getElementById("input").addEventListener("keyup", handleKeyInput);

    //sendStatusMessage is a function defined in this file. It's just what should happen if the user hits any key while on the status input
    document.getElementById("status-input").addEventListener("keyup", sendStatusMessage);

}

//this function just sees what type of message we are getting then calls the respective function to handle it
function handleMessage(message) {
    if (message.type == "roomUpdate") {
        updateCurrentRoom(message.message)
    } else if (message.type == "status") {
        displayUsersInRoom(message.message)
    } else if (message.type == "chat") {
        displayChat(message.username,message.message)
    } else if (message.type == "typing") {
        typingIndicator(message.message)
    } else if (message.type == "user-status") {
        updateStatusMessage(message.username,message.message,message)
    } else if (message.type == "image"){
        displayImage(message.username,message.message);
    } else {
        console.log("ERROR: Server sending message js cannot handle. Message: " + message.type);
    }
}

//we want to handle an update to the list of users in room, shown to client
function displayUsersInRoom(users){
    document.getElementById("users-list-message").innerText = ""; //set it to empty so loop can just append values
    document.getElementById("users-list").innerHTML = ""; //empties the list of users

    let userList = document.getElementById("users-list");

    const existingUsers = Array.from(userList.children).map(item => item.textContent);


    // //Removing any user who is no longer in the user list from the user list in the HTML (This would replace emptying the list
    //const userElements = [document.getElementById("users-list").querySelectorAll("li")];
    // for (const user of userElements) {
    //     console.log("User element:", user);
    //     if (!users.includes(user.textContent)) {
    //         console.log("Removing user:", user.textContent);
    //         userList.removeChild(user);
    //     }
    // }

    //appending any user who isn't already in the user list to the user list
    for(let i=0; i<users.length; i++){
        if (!existingUsers.includes(users[i])) {
            let tempItem = document.createElement("li");
            //tempItem.title = users[i];
            tempItem.textContent = users[i];
            userList.appendChild(tempItem);
        }
    }
}

//the message sent from the server should have "message" of "You are currently in room XZY"
//we just gotta put that in the correct element
function updateCurrentRoom(displayInfo) {
    document.getElementById("users-list").innerHTML = ""; //empties the list of users
    document.getElementById("current-room").innerText = displayInfo;
}

//outputs chat message to the log
function displayChat(username, message) {
    //creating a div for the message, this is where everything will be appended before appending the message div to the chat log
    let messageDiv = document.createElement('div');
    messageDiv.className = 'messageDiv';

    //this div will hold the username and the timestamp
    let senderDiv = document.createElement('div');
    senderDiv.className = 'senderDiv';

    let usernameSpan = document.createElement('span');
    usernameSpan.textContent = username;
    usernameSpan.className = 'usernames';

    let timestampSpan = document.createElement('span');
    timestampSpan.textContent = timestamp();
    timestampSpan.className = 'timestamps';

    senderDiv.appendChild(usernameSpan);
    senderDiv.appendChild(timestampSpan);

    let messageP = document.createElement('p');
    messageP.textContent = message;
    messageP.className = 'messages';

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(messageP);

    //appending the message div to the chat log
    let log = document.getElementById("log");
    log.appendChild(messageDiv);
}


//updates the typing indicator
function typingIndicator(message){
    if (document.getElementById("indicator").value === ""){

        document.getElementById("indicator").value = message;

        setTimeout(() => {
            document.getElementById("indicator").value = "";
        }, 2000);
    }
}

//this function is called when the refresh button is pressed, or when a new room is entered
function refreshRooms() {
    //refresh the list of rooms
    let callURL = "http://localhost:8080/WSChatServer-1.0-SNAPSHOT/refreshList";
    fetch(callURL, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
    })
        .then(response => response.json())
        .then(response => updateRoomsList(response)); //just log to console for now
}

//takes an array of rooms
//adds all room  in array as li button elements in ul with class="nav"
//format of li: <li><button onclick="enterRoom('RoomID')">RoomID</button></li>
function updateRoomsList(rooms) {
    console.log(rooms.rooms)
    document.querySelector(".nav").innerHTML = "";
    for (let i=0;i<rooms.rooms.length; i++){
        document.querySelector(".nav").innerHTML += ` <li><button onclick="enterRoom('${rooms.rooms[i].trim()}')">${rooms.rooms[i].trim()}</button></li>`;
    }
}

//function to be called on event listener for key press
function handleKeyInput(event){
    //function for when the enter key is pressed so the user's message can be sent
    if (event.key === "Enter" && event.target.id === "input" && event.target.value !== "") {
        console.log("data sending to server: " + event.target.value);
        let request = {"type": "chat", "msg": event.target.value};
        ws.send(JSON.stringify(request));
        event.target.value = "";

        userNamed = true;
    }
    //else statement for if any other key is pressed, so that the typing indicator is called
    else if (event.target.id === "input"){
        let msg = "a user is typing...";
        console.log("data sending to server: " + msg);
        let request = {"type": "typing", "msg": msg};
        ws.send(JSON.stringify(request));
    }
}

//timestamp function, gives the time at that specific hour and minute
function timestamp() {
    let d = new Date(), minutes = d.getMinutes();
    if (minutes < 10) minutes = '0' + minutes;
    return d.getHours() + ':' + minutes;
}

//function called when the send button is pressed
function sendButton(){
    //get the text from the input field
    let text = document.getElementById('input').value;

    //what to send if there is text
    if (text !== ""){
        //log it to console and send to server
        console.log("data sending to server: " +text);
        let request = {"type": "chat", "msg": text};
        ws.send(JSON.stringify(request));

        //reset the input field to empty
        document.getElementById('input').value = "";

        userNamed = true;
    }

    //get the image from the input field
    let imageInput = document.getElementById('image-input');

    //send the image if there is an image and the user has already created their username
    if (imageInput.files.length > 0 && userNamed === true) {
        let file = imageInput.files[0];
        let reader = new FileReader();

        reader.onloadend = function() {
            let base64Image = reader.result;
            console.log("data sending to server: " + base64Image);
            let request = {"type": "image", "msg": base64Image};
            ws.send(JSON.stringify(request));
        }

        reader.readAsDataURL(file);

        document.getElementById('image-input').value = "";
    }

}

//sends the status message to the server
function sendStatusMessage(event){
    if (event.key === "Enter" && event.target.id === "status-input" && userNamed) {
        console.log("data sending to server: " + event.target.value);
        let request = {"type": "user-status", "msg": event.target.value};
        ws.send(JSON.stringify(request));
        event.target.value = "";
    }
}

//updates the status message for the client side
function updateStatusMessage(username, message){
    let userlist = document.getElementById("users-list").children;
    for (let i = 0; i < userlist.length; i++) {
        if(userlist[i].textContent == username){
            userlist[i].title = "Status: "+ message;
            displayChat("server", username + " has changed their status to '" + message + "'");
            break;
        }
    }
}

//function that adds the image to the chatlog div
function displayImage(username, message) {
    //creating an image element and setting all of its values
    let image = document.createElement('img');
    image.src = message;
    image.alt = "Image sent by '" + username + "' at " + timestamp();
    image.title = "Image sent by '" + username + "' at " + timestamp();

    //creating a div that will contain the sender, timestamp, and the image
    let messageDiv = document.createElement('div');
    messageDiv.className = 'messageDiv';

    let senderDiv = document.createElement('div');
    senderDiv.className = 'senderDiv';

    let usernameSpan = document.createElement('span');
    usernameSpan.textContent = username;
    usernameSpan.className = 'usernames';

    let timestampSpan = document.createElement('span');
    timestampSpan.textContent = timestamp();
    timestampSpan.className = 'timestamps';

    senderDiv.appendChild(usernameSpan);
    senderDiv.appendChild(timestampSpan);

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(image);

    //appending the message div to the chat log
    let log = document.getElementById("log");
    log.appendChild(messageDiv);
    log.appendChild(document.createElement("br"));
}

//This function runs when the js loads (ie when the page first loads)
(function () {
    refreshRooms();
})();


