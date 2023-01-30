/*******************************************************************
*	Function Name	: webRTC signaling server
*	Description 	: Server which handles the offer and answer request 
********************************************************************/
/* library for websocket */
var WebSocketServer = require('ws').Server;
//let RTCPeerConnection = require('rtcpeerconnection');
var wss = new WebSocketServer({ port: 8886 });
/* to store the connection details */
var users = {};
/* to store the user list details */
var map = new Map();
var count_message = 0;
var conn_offer;
var webrtc = require("wrtc");
let peerConnection;
var client_name;
var log_user = "selva";
var configuration = {
	"iceServers": [
		{
			"urls": "stun:stun.1.google.com:19302"
		},
		{
			urls: 'turn:192.158.29.39:3478?transport=tcp',
			credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
			username: '28224511:1379330808'
		}
	]
};

wss.on('listening', function () {
	console.log(`Server started with port ${this.address().port}`);
});

wss.on('connection', function (connection) {
	/* Sucessful connection */
	console.log("User has connected");
	connection.on('message', function (message) {

		var isjsonstring = checkisJson(message);

		if(isjsonstring == true)
		{
			var data = JSON.parse(message);	/* Parse the messages from client */
			console.log("sorryyyyyyyyyyyyyyyyy",data.name)
			switch (data.type) {
					/* login request from client */
				case "login":
					/* If anyone login with same user name - refuse the connection */
					if (users[data.name]) {
						/* Already same username has logged in the server */
						/* send response to client back with login failed */
						sendTo(connection, { type: "server_login", success: false });
						console.log("login failed");
	
					} else {
						/* store the connection details */
						users[data.name] = connection;
						connection.name = data.name;
						connection.otherName = null;
						/* store the connection name in the userlist */
						map.set(data.name,'online');
						/* send response to client back with login sucess */
						sendTo(connection, { type: "server_login", success: true });
						console.log("Login sucess");
						/* send updated user lists to all users */
						const obj = Object.fromEntries(map);
	
						for (var i in users) {
							sendUpdatedUserlist(users[i],[...map]);
						}
					}
	
					break;
	
					/* Offer request from client*/
				case "offer":
					// /* Check the peer user has logged in the server */
					// if (users[data.name]) {
					// 	/* Get the peer connection from array */
					// 	var conn = users[data.name];
					// 	if (conn == null) {
					// 		/* Error handling */
					// 		sendTo(connection, { type: "server_nouser", success: false });
					// 	}
					// 	else if (conn.otherName == null) {
					// 		/* When user is free and availble for the offer */
					// 		/* Send the offer to peer user */
					// 		sendTo(conn, { type: "server_offer", offer: data.offer, name: connection.name });
					// 	}
					// 	else {
					// 		/* User has in the room, User is can't accept the offer */
					// 		sendTo(connection, { type: "server_alreadyinroom", success: true, name: data.name });
					// 	}
					// }
					// else {
					// 	/* Error handling with invalid query */
					// 	console.log("offer -> server_nouser");
					// 	sendTo(connection, { type: "server_nouser", success: false });
					// }
					client_name = data.name
					conn_offer = data.offer
					console.log("11")
					permission_camera_before_call()
					break;
	
					/* Answer request from client*/
				case "answer":
					/* Get the peer user connection details */
					var conn = users[data.name];
	
					if (conn != null) {
						/* Send the answer back to requested user */
						sendTo(conn, { type: "server_answer", answer: data.answer });
					}
	
					break;
	
					/* candidate request */
				case "candidate":
					/* Get connection details */
					var conn = users[data.name];
					// if (conn != null) {
					// 	/* Send candidate details to user */
					// 	sendTo(conn, { type: "server_candidate", candidate: data.candidate });
					// }
					//console.log("checkkk",conn.name)
					console.log("1111111111",data.candidate)
					onCandidate(data.candidate)
					async function onCandidate(candidate) {
					// try {
						console.log("222222222",candidate)
						await (peerConnection.addIceCandidate(candidate));
						onAddIceCandidateSuccess(peerConnection);
					//   } catch (e) {
					// 	onAddIceCandidateError(peerConnection, e);
					//   }  
					}
					break;
	
					/* when user want to leave from room */
				case "leave":
					/* Get connection details */
					var conn = users[data.name];
					if (conn != null) {
						/* Send response back to users who are in the room */
						sendTo(conn, { type: "server_userwanttoleave" });
						sendTo(connection, { type: "server_userwanttoleave" });
						map.set(data.name,'online');
						map.set(connection.name,'online');
						/* Update the connection status with available */
						conn.otherName = null;
						connection.otherName = null;
	
						for (var i in users) {
							sendUpdatedUserlist(users[i], [...map]);
						}
						console.log("end room");
					}
	
					break;
	
					/* When user reject the offer */
				case "busy":
					/* Get connection details */
					var conn = users[data.name];
					if (conn != null) {
						/* Send response back to user */
						sendTo(conn, { type: "server_busyuser" });
					}
	
					break;
	
				case "want_to_call":
					var conn = users[data.name];
					if (conn != null) {
						if((conn.otherName != null) && map.get(data.name) == "busy")
						{
							/* User has in the room, User is can't accept the offer */
							sendTo(connection, { type: "server_alreadyinroom", success: true, name: data.name });
						}
						else
						{
							/* User is avilable, User can accept the offer */
							sendTo(connection, { type: "server_alreadyinroom", success: false, name: data.name });
						}
						
					}
					else
					{
						/* Error handling with invalid query */
						console.log("fineee")
						sendTo(connection, { type: "server_alreadyinroom", success: false });
					}
					break;	
	
					/* Once offer and answer is exchnage, ready for a room */
				case "ready":
					/* Get connection details */
					var conn = users[data.name];
					if (conn != null) {
						/* Update the user status with peer name*/
						connection.otherName = data.name;
						conn.otherName = connection.name;
						map.set(data.name,'busy');
						map.set(connection.name,'busy');
						/* Send response to each users */
						sendTo(conn, { type: "server_userready", success: true, peername: connection.name });
						//sendTo(connection, { type: "server_userready", success: true, peername: conn.name });
						/* Send updated user list to all existing users */
						for (var i in users) {
							sendUpdatedUserlist(users[i], [...map]);
						}
					}
					console.log("20")
					break;
	
					/* user quit/signout */
				case "quit":
					/* Get the user details */
					if (data.name) {
						var quit_user = data.name;
						delete users[connection.name];
						map.delete(quit_user);
	
						/* Send updated user list to all existing users */
						for (var i in users) {
							sendUpdatedUserlist(users[i], [...map]);
						}
					}
	
					break;
	
					/* default */
				default:
					sendTo(connection, { type: "server_error", message: "Unrecognized command: " + data.type });
					break;
			}
		}
		else
		{
			//console.log("not a json");
			/* ping from client, so repond with pong to get server is alive.*/
			if(message == "clientping")
			{
				//console.log("clientping");
				sendTo(connection, { type: "server_pong", name: "pong" });
			}
		}


	});

	/* When socket connection is closed */
	connection.on('close', function () {
		console.log("** leaving **");
		if (connection.name) {
			var quit_user = connection.name;
			/* Remove from the connection */
			delete users[connection.name];
			map.delete(quit_user);

			if (connection.otherName) {
				/* when user is inside the room with peer user */
				var conn = users[connection.otherName];
				if (conn != null) {
					/* Update the details */
					conn.otherName = null;
					connection.otherName = null;
					/* Send the response back to peer user */
					sendTo(conn, { type: "server_exitfrom" });
					map.set(conn.name,'online');
				}
			}

			/* Send the updated userlist to all the existing users  */
			for (var i in users) {
				sendUpdatedUserlist(users[i], [...map]);
			}
		}
	});

});

/* function to send the userlist */
function sendUpdatedUserlist(conn, message) {
	conn.send(JSON.stringify({ type: "server_userlist", name: message }));

}
/* function to send the message */
function sendTo(conn, message) {
	conn.send(JSON.stringify(message));
}
/* function to check the message is JSON or not */
function checkisJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

/**
 * This function will print the ICE candidate sucess
 */ 
function onAddIceCandidateSuccess(pc) {
	console.log("7")
    console.log(` IceCandidate added successfully..`);
}
/**
 * This function will print the ICE candidate error
 */   
function onAddIceCandidateError(pc, error) {
    console.log(` Failed to add ICE Candidate: ${error.toString()}`);
}
/**
 * This function will send webRTC answer for offer request.
 */
async function permission_camera_before_call()
{
	peerConnection = new webrtc.RTCPeerConnection(configuration);
    console.log('Created server peer connection object peerConnection');
    console.log("12")
	console.log("5555555",peerConnection)
    peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));
	//peerConnection.addEventListener('track', gotRemoteStream);
	console.log("Got video from client side")
	console.log("13")
	console.log("Creating Answer..");
	peerConnection.ondatachannel = receiveChannelCallback;
	console.log("14")
	creating_answer(); 
}
/**
 * This function will handle the ICE state change
 */ 
function onIceStateChange(pc, event) {
    if (pc) {
      console.log(`ICE state: ${pc.iceConnectionState}`);
      console.log('ICE state change event: ', event);
    }
}
/**
 * Registration of data channel callbacks
 */
var receiveChannelCallback = function (event) {
    Receive_dataChannel = event.channel;
    Receive_dataChannel.onopen = onReceive_ChannelOpenState;
    Receive_dataChannel.onmessage = onReceive_ChannelMessageCallback;
    Receive_dataChannel.onerror = onReceive_ChannelErrorState;
    Receive_dataChannel.onclose = onReceive_ChannelCloseStateChange;
};
/**
 * This function will handle the data channel open callback.
 */
var onReceive_ChannelOpenState = function (event) {
    flag_send_datachannel = false;
    console.log("dataChannel.OnOpen", event);

    if (Receive_dataChannel.readyState == "open") {
        /* Open state */
    }
};
/**
 * This function will handle the data channel message callback (Peer user side).
 */
var onReceive_ChannelMessageCallback = function (event) {
    count_message++;           //Count the messages
    console.log(`message received from client.....msg no:${count_message}`)
};
/**
 * This function will handle the data channel error callback.
 */
var onReceive_ChannelErrorState = function (error) {
    console.log("dataChannel.OnError:", error);
};
/**
 * This function will handle the data channel close callback.
 */
var onReceive_ChannelCloseStateChange = function (event) {
    /* close event */
};
async function creating_answer() {
    try {
      await peerConnection.setRemoteDescription(conn_offer);
      onSetRemoteSuccess(peerConnection);
	  peerConnection.addEventListener('icecandidate', e => icecandidateAdded(e));
    } catch (e) {
      onSetSessionDescriptionError(e);
     // clear_incoming_modal_popup(); /*remove modal when any error occurs */
    }
    console.log("creating answer..");
	try {
        const answer = await peerConnection.createAnswer();
        console.log(" answer created = "+ answer);
        await onCreateAnswerSuccess(answer);
      } catch (e) {
        onCreateSessionDescriptionError(e);
    }
}
/**
 * This function will print log of remote description sucess
 */ 
function onSetRemoteSuccess(pc) {
	console.log("15")
    console.log(`setRemoteDescription complete`);
}
/**
 * This function will print log of remote description error
 */  
function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
}
/**
 * This function will handle ICE candidate event. 
 */
function icecandidateAdded(ev) {

	var conn = users[client_name];
    console.log(ev,"ss")
    console.log("ee",ev.candidate)
    console.log("6")
	if (conn != null) {
		if (ev.candidate) {
			sendTo(conn, { type: "server_candidate", candidate: ev.candidate });
			console.log("ICE candidate has send to client ..");   
			console.log("16")
		}
	}
}
/**
 * This function will print log of local description error
 */
function onCreateSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}`);
}
/**
 * This function will handle local description of server 
 */
async function onCreateAnswerSuccess(desc) {
    console.log('server setLocalDescription start');
	console.log("17")
    try {
      await peerConnection.setLocalDescription(desc);
      onSetLocalSuccess(peerConnection);
    } catch (e) {
      onSetSessionDescriptionError(e);
    }
    //store the answer
    conn_answer = desc;
    console.log("sending answer to client.."); 
	var conn = users[log_user];
	if (conn != null) {
		/* Send the answer back to requested user */
		sendTo(conn, { type: "server_answer", answer: conn_answer });
	}
  }
  /**
 * This function will print log of local description sucess
 */
function onSetLocalSuccess(pc) {
	console.log("18")
    console.log(`setLocalDescription of server complete`);
}