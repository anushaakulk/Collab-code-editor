import React, { useEffect, useRef, useState } from 'react';
import Avatar from 'react-avatar';

const Video = ({ client, username, socket, stream, roomId, isLocalUser }) => {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const remoteVideoRefs = useRef({});
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [key, setKey] = useState();
  const [off, setOff] = useState(true);
  const [peerConnection, setPeerConnection] = useState(new RTCPeerConnection());
  const [peerConnections, setPeerConnections] = useState({});
  const [remoteVideoSenders, setRemoteVideoSenders] = useState({});
  let localStream = null;

  useEffect(() => {
    // Get user media and display it locally
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
        localStream=stream;
        peerConnection.addStream(stream);
      })
      .catch((error) => console.error('Error accessing media devices:', error));

    // Listen for remote stream and display it
    peerConnection.onaddstream = (event) => {
      remoteVideoRef.current.srcObject = event.stream;
    };

    // Listen for ICE candidates and send them to the signaling server
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    // Create offer and emit it to the signaling server
    peerConnection.createOffer()
      .then((offer) => {
        peerConnection.setLocalDescription(offer);
        console.log("Offer sending", offer);
        setKey(client.socketId);
        console.log(key);
        socket.emit('offer', { roomId, offer, client });
      })
      .catch((error) => console.error('Error creating offer:', error));

    // Listen for signaling events (offer, answer)
    socket.on('offer', (offer, client) => {
      const newPeerConnection = new RTCPeerConnection();

      console.log("Before state update:", peerConnections);

      setPeerConnections((prevConnections) => ({
        ...prevConnections,
        [username]: newPeerConnection,
      }));

      console.log("After state update:", peerConnections);

      newPeerConnection.onaddstream = (event) => {
        // Use a unique ref for each remote user
        remoteVideoRefs.current[username].current.srcObject = event.stream;
      };

      newPeerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { roomId, username, candidate: event.candidate });
        }
      };
      let answer;

      newPeerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        // Create answer after setting the remote description
        return newPeerConnection.createAnswer();
      })
      .then((answer) => {
        // Set local description with the created answer
        return newPeerConnection.setLocalDescription(answer);
      })
      .then(() => {
        // Access senders after setLocalDescription
        const videoSender = newPeerConnection.getSenders().find((sender) => sender.track && sender.track.kind === 'video');

        // Update the state with the new sender
        setRemoteVideoSenders((prevSenders) => ({
          ...prevSenders,
          [username]: videoSender,
        }));

        // Emit the answer to the signaling server
        socket.emit('answer', { roomId, answer: newPeerConnection.localDescription });
      })
      .catch((error) => console.error('Error creating answer:', error));
    });

    socket.on('answer', (data) => {
      const peerConnectionToUpdate = peerConnections[data.socketId];
      if (peerConnectionToUpdate) {
        peerConnectionToUpdate.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

  }, [socket, roomId]);

  const toggleVideo = async () => {
    console.log('Toggle Video');
    setVideoEnabled((prev) => {
      console.log('Previous Video State:', prev);
      if(!prev){
        window.location.reload(false);
      }
      const videoTrack = localVideoRef.current.srcObject.getVideoTracks()[0];
      console.log(videoTrack);
      if (videoTrack) {
        videoTrack.enabled = !prev;
        setOff(!off);
      }
      // Emit the updated video state to others
      socket.emit('toggle-video', { username, roomId, key, videoEnabled: !prev });
      console.log('Toggle Video Event Emitted');
      return !prev;
    });
  };

  useEffect(() => {
    const handleToggleVideo = ({ username, videoEnabled: remoteVideoEnabled }) => {
      console.log('Handle Toggle Video for', username);
      console.log('Remote Video State:', remoteVideoEnabled);

      setVideoEnabled(remoteVideoEnabled); // Update the local state
      const remoteVideoSender = remoteVideoSenders[username];

      const remotePeerConnection = peerConnections[username];
      console.log(remotePeerConnection);
      if (remoteVideoSender) {
        // Toggle the enabled state of the video track
        remoteVideoSender.track.enabled = remoteVideoEnabled;
        console.log('Remote video state updated successfully.');
      } else {
        console.error('No video sender found on the remote peer connection.');
      }
    };

    socket.on('toggle-video', handleToggleVideo);

    return () => {
      // Cleanup event listeners
      socket.off('toggle-video', handleToggleVideo);
    };
  }, [socket, peerConnections]);

  return (
    <div className='videoContainer'>
      <span className="userName">{username}</span>
      <div className='videoFeature'>
      {videoEnabled ? (
                <video className='videoFeature' ref={localVideoRef} autoPlay playsInline muted />
                ) : (
                    <Avatar className='videoFeature' name={username} size={150} round="1px" />
                )}
        {isLocalUser && (
          <button onClick={toggleVideo}>
            {videoEnabled ? 'Disable Video' : 'Enable Video'}
          </button>
        )}
      </div>
      {remoteVideoRef.current && <video className='videoFeature' ref={remoteVideoRef} autoPlay playsInline />}
    </div>
  );
};

export default Video;