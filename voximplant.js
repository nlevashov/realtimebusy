VoxEngine.addEventListener(AppEvents.CallAlerting, function(e) {
    const call = e.call;
    let webSocket;

    let serverConnected = false;
    let callTransfered = false;
    let timeoutDuration = 120000; // Default to 2 minutes

    let recordUrl = '';
    call.addEventListener(CallEvents.RecordStarted, function(e) {
        Logger.write("LOG OUTGOING: CallEvents.RecordStarted");
        recordUrl = e.url;
        call.sendMessage(JSON.stringify({
            "type": "record_url",
            "record_url": recordUrl
        }));
        if (serverConnected) {
            webSocket.send(JSON.stringify({
                "event": "record_url",
                "record_url": recordUrl
            }));
        }
    });
    call.record();

    call.startEarlyMedia();
    call.answer();

    webSocket = VoxEngine.createWebSocket("wss://busy.contact/ws");

    webSocket.addEventListener(WebSocketEvents.ERROR, function(e) {
        Logger.write("LOG OUTGOING: WebSocketEvents.ERROR");
    });
    webSocket.addEventListener(WebSocketEvents.CLOSE, function(e) {
        Logger.write("LOG OUTGOING: WebSocketEvents.CLOSE: " + e.reason);
        endCall();
    });
    webSocket.addEventListener(WebSocketEvents.OPEN, function(e) {
        Logger.write("LOG OUTGOING: WebSocketEvents.OPEN");
        Logger.write(JSON.stringify(e));
        serverConnected = true;
        call.sendMediaTo(webSocket, {
            encoding: WebSocketAudioEncoding.ALAW,
            "tag": "MyAudioStream",
            "customParameters": {
                "param1": "12345"
            }
        });
        if (recordUrl) {
            webSocket.send(JSON.stringify({
                "event": "record_url",
                "record_url": recordUrl
            }));
        }
    });
    webSocket.addEventListener(WebSocketEvents.MESSAGE, function(e) {
        Logger.write("LOG OUTGOING: WebSocketEvents.MESSAGE");
        Logger.write(e.text);
        try {
            data = JSON.parse(e.text);
            if (!data.type) return; // Exit if type is not present

            if (data.type === "command") {
                if (data.command === "connect_human") {
                    // Create an outbound call
                    const outCall = VoxEngine.callPSTN("<PHONE_NUMBER_DESTINATION>", "<PHONE_NUMBER_FROM>", {followDiversion: false});
                    outCall.addEventListener(CallEvents.Connected, (out) => {
                        Logger.write("LOG OUTGOING: Outbound call connected");
                        VoxEngine.sendMediaBetween(call, out.call);
                        callTransfered = true;
                        clearTimeout(callTimeout); // Clear the initial timeout
                        callTimeout = setTimeout(endCall, 300000); // Set new timeout for 5 minutes
                    });
                    outCall.addEventListener(CallEvents.Failed, (out) => {
                        Logger.write("LOG OUTGOING: Outbound call failed");
                    });
                    outCall.addEventListener(CallEvents.Disconnected, (out) => {
                        Logger.write("LOG OUTGOING: Outbound call disconnected");
                        endCall();
                    });

                } else if (data.command === "finish_call") {
                    if (!callTransfered) {
                        endCall();
                    }
                }
            } else if (data.type === "replica") {
                call.sendMessage(e.text);
            }
        } catch (error) {
            Logger.write("Error parsing WebSocket message:", error);
        }
    });
    webSocket.sendMediaTo(call, { tag: "outcoming" });

    // Function to end the call and close the WebSocket
    function endCall() {
        call.hangup();
        webSocket.close();
        setTimeout(VoxEngine.terminate, 1000);
    }

    // Set a timeout to end the call after 2 minutes initially
    let callTimeout = setTimeout(endCall, 120000);

    // Event listener for caller disconnection
    call.addEventListener(CallEvents.Disconnected, endCall);
});
