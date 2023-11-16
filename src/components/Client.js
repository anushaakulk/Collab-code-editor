import React, { useCallback,useState, useEffect} from 'react';
import Avatar from 'react-avatar';
import ACTIONS from '../Actions';
import ReactPlayer from 'react-player';
import peer from "../service/peer"

const Client = ({socketRef, key, username }) => {
    const [myStream,setMyStream] = useState();
    
    const handleVideo = useCallback(async()=>{
        const stream = await navigator.mediaDevices.getUserMedia({audio:true, video:true});
        const offer = await peer.getOffer();
        socketRef.current.emit(ACTIONS.CALL,{to: key,offer});
        setMyStream(stream);
    },[key,socketRef.current]);

    const handleIncomingCall = useCallback(({ from, offer })=>{
        console.log("Incoming call ",from,offer)
    }, [])

    useEffect(()=>{
        socketRef.current.on("incoming:call",handleIncomingCall);
        return() =>{
            socketRef.current.off("incoming:call",handleIncomingCall);
        }
    },[socketRef,handleIncomingCall])

    return (
        <div className="client">
            {!myStream && <button onClick={handleVideo}>On Video</button>}
            {myStream && <ReactPlayer className="react-player" playing muted height="50px" width="50px" url={myStream}/>}
            <Avatar name={username} size={50} round="14px" />
            <span className="userName">{username}</span>
        </div>
    );
};

export default Client;
