import React, { useState } from 'react';
import './index.css';

const API_URL = 'http://localhost:3000';

const App: React.FC = () => {
  const [token, setToken] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (data.success) {
      setIsLoggedIn(true);
      loadQr();
    } else {
      alert('Invalid token');
    }
  };

  const loadQr = async () => {
    try {
      const res = await fetch(`${API_URL}/qr`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (data.qr) {
        setQrCode(data.qr);
      } else {
        setTimeout(loadQr, 3000);
      }
    } catch {
      setTimeout(loadQr, 3000);
    }
  };

  const handleSend = async () => {
    const phoneList = numbers
      .split('\n')
      .map(n => n.trim().replace(/[^\d]/g, ''))
      .filter(n => n)
      .map(n => n.startsWith('91') ? n : '91' + n);

    setStatus('Sending...');

    const res = await fetch(`${API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token
      },
      body: JSON.stringify({ number: phoneList, message }),
    });

    const data = await res.json();
    if (res.ok) {
      const output = data.results.map((r: any) =>
        `${r.number}: ${r.status}${r.error ? ` (${r.error})` : ''}`).join('\n');
      setStatus(`✅ Results:\n${output}`);
    } else {
      setStatus(`❌ Failed: ${data.error || 'Unknown error'}`);
    }
  };

  return (
    <div className="app">
      <h1>WhatsApp Messenger</h1>

      {!isLoggedIn ? (
        <div className="login-container">
          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="token">Enter Access Token</label>
            <input
              id="token"
              type="password"
              placeholder="Enter access token"
              value={token}
              onChange={e => setToken(e.target.value)}
            />
            <button type="submit">Login</button>
          </form>
        </div>
      ) : (
        <>
          <div className="container">
            <section className="panel qr-container">
              <h2 className="panel-title">QR Code</h2>
              {qrCode ? (
                <img src={qrCode} alt="QR Code" className="qr-code" />
              ) : (
                <p>Waiting for QR...</p>
              )}
              <button className="qr-button" onClick={loadQr}>Regenerate QR</button>
            </section>

            <section className="panel message-container">
              <h2 className="panel-title">Send Message</h2>
              <textarea
                placeholder="Enter phone numbers (one per line)"
                rows={5}
                value={numbers}
                onChange={e => setNumbers(e.target.value)}
              />
              <textarea
                placeholder="Enter message"
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
              <pre className="status">{status}</pre>
            </section>
          </div>

          <div className="send-button-wrapper">
            <button className="send-button" onClick={handleSend}>Send Message</button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
