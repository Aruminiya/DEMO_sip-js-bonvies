import { useState, useEffect, useRef } from 'react';
import './App.css';
import { UserAgent, Inviter, SessionState } from 'sip.js';
// import ringbacktone from './assets/ringbacktone.mp3';

function App() {
  const [wsServer, setWsServer] = useState('');
  const [domains, setDomains] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [userAgent, setUserAgent] = useState<UserAgent | null>(null);
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      if (userAgent) {
        userAgent.stop();
      }
    };
  }, [userAgent]);

  const handleSubmit = async (event: { preventDefault: () => void; }) => {
    event.preventDefault();

    const domainList = domains.split(',');
    const uri = UserAgent.makeURI(`sip:${username}@${domainList[0]}`);
    if (!uri) {
      alert("無法創建URI");
      return;
    }

    const ua = new UserAgent({
      uri,
      displayName,
      authorizationUsername: username,
      authorizationPassword: password,
      transportOptions: {
        server: wsServer,
      },
    });

    setUserAgent(ua);

    try {
      await ua.start();
      const targetURI = UserAgent.makeURI(`sip:${callNumber}@${domainList[0]}`);
      if (!targetURI) {
        alert("無法創建目標URI");
        return;
      }

      const inviter = new Inviter(ua, targetURI);
      inviter.stateChange.addListener((state) => {
        if (state === SessionState.Established) {
          // 停止播放音檔
          if (ringbackAudioRef.current) {
            ringbackAudioRef.current.pause();
            ringbackAudioRef.current.currentTime = 0;
          }

          const audioElement = document.getElementById('remoteAudio') as HTMLAudioElement;
          if (audioElement) {
            const remoteStream = new MediaStream();
            if (inviter.sessionDescriptionHandler) {
              (inviter.sessionDescriptionHandler as unknown as { peerConnection: RTCPeerConnection }).peerConnection.getReceivers().forEach((receiver: { track: MediaStreamTrack; }) => {
                if (receiver.track) {
                  remoteStream.addTrack(receiver.track);
                }
              });
            }
            audioElement.srcObject = remoteStream;
            audioElement.play();
          }
        } else if (state === SessionState.Terminated) {
          // 停止播放音檔
          if (ringbackAudioRef.current) {
            ringbackAudioRef.current.pause();
            ringbackAudioRef.current.currentTime = 0;
          }
        }
      });

      // 撥打電話時播放音檔
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.play();
      }

      await inviter.invite();
      alert("呼叫已發起");
    } catch (error) {
      console.error("呼叫失敗", error);
      alert("呼叫失敗");
    }
  };

  return (
    <>
      <h1>撥打電話</h1>
      <form id="callForm" onSubmit={handleSubmit}>
        <label htmlFor="wsServer">WebSocket Server:</label>
        <input type="text" id="wsServer" name="wsServer" value={wsServer} onChange={(e) => setWsServer(e.target.value)} required />
        <br />

        <label htmlFor="domains">Domains (逗號分隔):</label>
        <input type="text" id="domains" name="domains" value={domains} onChange={(e) => setDomains(e.target.value)} required /><br />

        <label htmlFor="username">Username:</label>
        <input type="text" id="username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} required /><br />

        <label htmlFor="password">Password:</label>
        <input type="password" id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required /><br />

        <label htmlFor="displayName">Display Name:</label>
        <input type="text" id="displayName" name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /><br />

        <label htmlFor="callNumber">Call Number:</label>
        <input type="text" id="callNumber" name="callNumber" value={callNumber} onChange={(e) => setCallNumber(e.target.value)} required /><br />

        <button type="submit">撥打</button>
      </form>

      <audio id="remoteAudio" autoPlay></audio>
      <audio ref={ringbackAudioRef} src="/src/assets/ringbacktone.mp3" loop></audio>
    </>
  );
}

export default App;