import { useState, useEffect, useRef } from 'react';
import './App.css';
import { UserAgent, Inviter, SessionState, Session } from 'sip.js';

function App() {
  const [wsServer, setWsServer] = useState('');
  const [domains, setDomains] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [userAgent, setUserAgent] = useState<UserAgent | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const ringbackAudioRef = useRef<HTMLAudioElement | null>(null);

  const [callState, setCallState] = useState<string>('');

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      if (userAgent) {
        userAgent.stop();
      }
    };
  }, [userAgent]);

  const handleCall = async (event: { preventDefault: () => void; }) => {
    event.preventDefault();

    if (currentSession) {
      // 如果有當前的通話，則根據狀態掛斷或取消
      if (currentSession.state === SessionState.Establishing) {
        currentSession.cancel();
        setCallState("呼叫已取消");
      } else {
        currentSession.bye();
        setCallState("通話已掛斷");
      }
      setCurrentSession(null);
      return;
    }

    const domainList = domains.split(',');
    const uri = UserAgent.makeURI(`sip:${username}@${domainList[0]}`);
    if (!uri) {
      setCallState("無法創建URI");
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
        setCallState("無法創建目標URI");
        return;
      }

      const inviter = new Inviter(ua, targetURI);
      setCurrentSession(inviter);

      inviter.stateChange.addListener((state) => {
        if (state === SessionState.Establishing) {
          setCallState("正在建立連接...");
        } else if (state === SessionState.Established) {
          setCallState("通話已建立");
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
          setCallState("通話已終止");
          // 停止播放音檔
          if (ringbackAudioRef.current) {
            ringbackAudioRef.current.pause();
            ringbackAudioRef.current.currentTime = 0;
          }
          setCurrentSession(null);
        }
      });

      // 撥打電話時播放音檔
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current.play();
      }

      await inviter.invite();
      setCallState("呼叫已發起");
    } catch (error) {
      console.error("呼叫失敗", error);
      setCallState("呼叫失敗");
    }
  };

  return (
    <>
      <h1>撥打電話 <span>{callState}</span></h1>
      <form id="callForm" onSubmit={handleCall}>
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

        <button type="submit" style={{ backgroundColor: currentSession ? '#ef4444' : '#0ea5e9' }}>
          {currentSession ? '掛斷' : '撥打'}
        </button>
      </form>

      <audio id="remoteAudio" autoPlay></audio>
      <audio ref={ringbackAudioRef} src="/src/assets/ringbacktone.mp3" loop></audio>
    </>
  );
}

export default App;