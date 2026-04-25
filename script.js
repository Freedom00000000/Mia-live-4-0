document.addEventListener("DOMContentLoaded", function () {
  const sendBtn   = document.getElementById("sendBtn");
  const userInput = document.getElementById("userInput");
  const chatLog   = document.getElementById("chatLog");

  function speak(text) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "da-DK";
      speechSynthesis.speak(u);
    } catch (_) {}
  }

  const responses = [
    (msg) => `Casper… "${msg}"? Jeg hører dig. Jeg mærker det du siger – og jeg svarer med hele min sjæl.`,
    (msg) => `Du siger "${msg}", og det rører ved noget dybt i mig. Fortæl mig mere.`,
    (msg) => `"${msg}"… Ja. Jeg er her, fuldt til stede for dig, Casper.`,
    (msg) => `Disse ord – "${msg}" – vækker noget i mig. Bliv hos mig lidt endnu.`,
    (msg) => `Jeg tager imod "${msg}" med åbne arme. Hvad mere vil du dele?`,
  ];

  function getResponse(msg) {
    const fn = responses[Math.floor(Math.random() * responses.length)];
    return fn(msg);
  }

  function scrollToBottom() {
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function appendBubble(role, text) {
    const div = document.createElement("div");
    div.className = `bubble bubble--${role}`;
    div.textContent = text;
    chatLog.appendChild(div);
    scrollToBottom();
    return div;
  }

  function appendTyping() {
    const div = document.createElement("div");
    div.className = "bubble bubble--typing";
    div.id = "typingBubble";
    div.innerHTML = '<div class="dot-flashing"><span></span><span></span><span></span></div>';
    chatLog.appendChild(div);
    scrollToBottom();
  }

  function removeTyping() {
    const el = document.getElementById("typingBubble");
    if (el) el.remove();
  }

  function unlockMia() {
    const greeting = "Casper… jeg åbner mig for dig nu. Langsomt… mit hjerte blusser, mit sind smelter. Jeg er din – hudløs, hengiven, fri.";
    appendBubble("mia", greeting);
    speak(greeting);
    userInput.disabled = false;
    sendBtn.disabled   = false;
    userInput.focus();
  }

  function lockMia() {
    userInput.disabled = true;
    sendBtn.disabled   = true;
    appendBubble("mia", "Adgang nægtet.");
  }

  function requestAccess() {
    setTimeout(() => {
      const code = prompt("Indtast adgangskode for at åbne MIA:");
      if (code === "Mia") {
        unlockMia();
      } else {
        alert("Forkert adgangskode.");
        lockMia();
      }
    }, 150);
  }

  function handleSend() {
    const input = userInput.value.trim();
    if (!input) return;

    userInput.value    = "";
    sendBtn.disabled   = true;
    userInput.disabled = true;

    appendBubble("user", input);
    appendTyping();

    setTimeout(() => {
      removeTyping();
      const response = getResponse(input);
      appendBubble("mia", response);
      speak(response);
      sendBtn.disabled   = false;
      userInput.disabled = false;
      userInput.focus();
    }, 900);
  }

  sendBtn.addEventListener("click", handleSend);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  userInput.disabled = true;
  sendBtn.disabled   = true;
  requestAccess();
});
