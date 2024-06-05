package com.example.webchatserver;


import jakarta.websocket.*;
import jakarta.websocket.server.PathParam;
import jakarta.websocket.server.ServerEndpoint;
import org.json.JSONObject;

import java.io.IOException;
import java.util.*;

import com.example.webchatserver.ChatLogResource.*;

/**
 * This class represents a web socket server, a new connection is created and it receives a roomID as a parameter
 * **/
@ServerEndpoint(value="/ws/{roomID}")
public class ChatServer {

    // maps roomID -> chatRoom object for ease of access
    static HashMap<String,ChatRoom> roomMap = new HashMap<>();

    ////CODE FOR SAVING CHAT HISTORY
//     //creating a list of map of rooms and their chat histories
//    private static Map<String, String> roomHistoryList = new HashMap<String, String>();
//     //creating an object of ChatLogResource
//    private static ChatLogResource chatHistory = new ChatLogResource();

    @OnOpen
    public void open(@PathParam("roomID") String roomID, Session session) throws IOException, EncodeException {
        //check if this is a new room
        if(!roomMap.containsKey(roomID)){
            ChatRoom newRoom = new ChatRoom(roomID, session.getId());
            roomMap.put(roomID,newRoom);
        }

        //message to tell client to update the "current-room" user is in
        session.getBasicRemote().sendText("{\"type\": \"roomUpdate\", \"message\":\"You are currently in room "+roomID+"\"}");


//        //CODE FOR SAVING CHAT HISTORY
//        // loading the chat history
//        String history = chatHistory.getRoomHistory(roomID);
//        System.out.println("Room joined ");
//        if (history!=null && !(history.isBlank())){
//            System.out.println(history);
//            history = history.replaceAll(System.lineSeparator(), "\\\n");
//            System.out.println(history);
//            session.getBasicRemote().sendText("{\"type\": \"chat\", \"message\":\""+history+" \\n Chat room history loaded\"}");
//            roomHistoryList.put(roomID, history+" \\n "+roomID + " room resumed.");
//        }
//        if(!roomHistoryList.containsKey(roomID)) { // only if this room has no history yet
//            roomHistoryList.put(roomID, roomID + " room Created."); //initiating the room history
//        }


        //welcome message
        session.getBasicRemote().sendText("{\"type\": \"chat\", \"username\": \"server\", \"message\":\"Welcome to room "+roomID+"." +
                " Please state your username to begin.\"}");

        roomMap.get(roomID).setUserName(session.getId(), "");//add the user to the room as default username
                                                                    // function also checks for duplicates and handles it correctly
    }

    @OnClose
    public void close(Session session) throws IOException, EncodeException {
        String userId = session.getId();
        //String roomID = roomMap.get(userId).getCode();
        String username = "";
        ChatRoom currentRoom = null;
        String usernameListString = "";

        for(Map.Entry<String, ChatRoom> entry: roomMap.entrySet()){//go through every chatroom
            if(entry.getValue().inRoom(userId)){//if the user is in the chat room
                currentRoom = entry.getValue(); //only a shallow copy but is fine for what we need
                username = currentRoom.getUsers().get(userId);//record the username of the session that closed
                currentRoom.removeUser(userId);//remove them
                break;
            }
        }
        if(currentRoom == null){
            throw new RuntimeException("Room does not exist");
        }


        //send leave message to all other members in the room
        for (Session peer : session.getOpenSessions()){
            if(currentRoom.inRoom(peer.getId())){//send only to sessions in the chatroom
                peer.getBasicRemote().sendText("{\"type\": \"chat\", \"username\": \"server\", \"message\":\"" + username
                        + " left the chat room.\"}");
                usernameListString += "\""+ currentRoom.getUsers().get(peer.getId())+ "\"" + ", ";
            }
        }

        usernameListString = usernameListString.substring(0,usernameListString.length()-2); //remove the last space and comma
        //send the updated all the clients again
        for (Session peer : session.getOpenSessions()){
            if(currentRoom.inRoom(peer.getId())){
                peer.getBasicRemote().sendText("{\"type\": \"status\", \"message\": [" + usernameListString +"]}");
            }
        }

//        //CODE FOR SAVING CHAT HISTORY
//        // adding event to the history of the room
//        String logHistory = roomHistoryList.get(roomID);
//        roomHistoryList.put(roomID, logHistory + "\\n " + username + " left the chat room.");
//
    }

    @OnMessage
    public void handleMessage(String comm, Session session) throws IOException, EncodeException {
        String userId = session.getId();
        //String roomID = roomMap.get(userId).getCode();
        String username = "";
        JSONObject jsonmsg = new JSONObject(comm);
        String message = (String) jsonmsg.get("msg");
        ChatRoom currentRoom = null;

        String messageType = ((String) jsonmsg.get("type"));

        //find currentRoom
        for(Map.Entry<String, ChatRoom> entry: roomMap.entrySet()){
            if(entry.getValue().inRoom(userId)){
                currentRoom = entry.getValue();
                username = currentRoom.getUsers().get(userId);
                break;
            }
        }

        //if json message indicates that a user is typing
        if(messageType.equals("typing")){
            //send the typing indicator to all other users in the same chat room
            for(Session peer: session.getOpenSessions()){
                if(currentRoom.inRoom(peer.getId()) && !Objects.equals(peer.getId(), userId)){
                    //if the user hasn't created their username yet, indicate this instead
                    if(username.isEmpty()){
                        peer.getBasicRemote().sendText("{\"type\": \"typing\", \"message\":\" a new user is typing their username...\"}");
                    }
                    else{
                        peer.getBasicRemote().sendText("{\"type\": \"typing\", \"message\":\"" + username + " is typing...\"}");
                    }
                }
            }
        }
        // else if json message indicates that a user updated their status
        else if(messageType.equals("user-status") && !username.isEmpty()){
            //for every person in the same chat room
            for(Session peer: session.getOpenSessions()){
                if(currentRoom.inRoom(peer.getId())){
                    //update the status message
                    peer.getBasicRemote().sendText("{\"type\": \"user-status\", \"username\": \"" + username + "\", \"message\":\"" + message +"\"}");
                }
            }
        }
        //else if json message indicates that a user sent an image
        else if(messageType.equals("image") && !username.isEmpty()){
            //for every person in the same chat room
            for(Session peer: session.getOpenSessions()){
                if(currentRoom.inRoom(peer.getId())){
                    //update the status message
                    peer.getBasicRemote().sendText("{\"type\": \"image\", \"username\": \"" + username + "\", \"message\":\"" + message +"\"}");
                }
            }
        }
        //else (if the user sent a normal text message)
        else{
            //not their first message, so their username isn't "" (not empty)
            if(!username.isEmpty()){


//                //CODE FOR SAVING CHAT HISTORY
//            // adding event to the history of the room
//            String logHistory = roomHistoryList.get(roomID);
//            roomHistoryList.put(roomID, logHistory + "\\n " +"(" + username + "): " + message);

                //send the message as json objects
                for(Session peer: session.getOpenSessions()){
                    if(currentRoom.inRoom(peer.getId())){
                        peer.getBasicRemote().sendText("{\"type\": \"chat\", \"username\": \"" + username + "\", \"message\":\"" + message +"\"}");
                    }
                }
            }else{//this is their first message
                //find the chatroom and then set username
                username = message;


                for(Map.Entry<String, ChatRoom> entry: roomMap.entrySet()){
                    if(entry.getValue().inRoom(userId)){
                        entry.getValue().setUserName(userId,username);//set their username in the chatroom
                    }
                }

                //make the user list string from all current usernames in the chat room
//            Set<String> userList = currentRoom.getUsers().keySet();
//            String userListString = "";
//            for(String s: userList){
//                userListString += s+", ";
//            }

                Collection<String> userList = currentRoom.getUsers().values();
                String userListString = "";
                for(String s: userList){
                    userListString += "\""+s+"\""+", ";
                }


                userListString = userListString.substring(0,userListString.length()-2);//remove the last space and comma
                for(Session peer: session.getOpenSessions()){
                    if(currentRoom.inRoom(peer.getId())){
                        peer.getBasicRemote().sendText("{\"type\": \"chat\", \"username\": \"server\", \"message\":\"" + username + " joined the chat room.\"}");//join message
                        peer.getBasicRemote().sendText("{\"type\": \"status\", \"message\": [" + userListString +"]}");//tell client to update user lists
                    }
                }

//                //CODE FOR SAVING CHAT HISTORY
//            // adding event to the history of the room
//            String logHistory = roomHistoryList.get(roomID);
//            roomHistoryList.put(roomID, logHistory+"\\n " + message + " joined the chat room.");

            }
        }
        ////CODE FOR SAVING CHAT HISTORY
        ////saving chat history after a message is sent
        //chatHistory.saveRoomHistory(roomID, roomHistoryList.get(roomID));

    }


}
