document.getElementById("start").addEventListener("click", () => {
  const role = document.getElementById("role").value;
  const company = document.getElementById("company").value;
  const location = document.getElementById("location").value;
  const message = document.getElementById("message").value;
  const limit = parseInt(document.getElementById("limit").value);

  chrome.runtime.sendMessage({
    action: "start-connection",
    payload: { role, company, location, message, limit }
  });
});

document.getElementById("stop").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stop-connection" });
});

document.getElementById("stop-referrals").onclick = () => {
  chrome.runtime.sendMessage({ action: "stop-referrals" });
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "update-ui") {
    const listDiv = document.getElementById("connected-list");
    listDiv.innerHTML = "";
    request.people.forEach(person => {
      const div = document.createElement("div");
      div.innerHTML = `${person.sent ? '<span style=\"color:green;\">✔️</span> ' : ''}${person.name} ${person.headline ? '- ' + person.headline : ''}`;
      listDiv.appendChild(div);
    });
  }
  if (request.action === "referral-skipped") {
    alert("No referral template found for these companies:\n" + request.skippedCompanies.join("\n"));
  }
  if (request.action === "referral-sent") {
    alert(`Referral message sent for company: ${request.company}`);
  }
});

// Template management logic
const templateListDiv = document.getElementById('template-list');
const newCompanyInput = document.getElementById('new-company');
const newTemplateInput = document.getElementById('new-template');
const addTemplateBtn = document.getElementById('add-template');

function renderTemplates(templates) {
  templateListDiv.innerHTML = '';
  Object.entries(templates).forEach(([company, message]) => {
    const div = document.createElement('div');
    div.style.marginBottom = '6px';
    div.innerHTML = `<b>${company}</b>: <span style='font-size:12px;'>${message}</span> <button data-company="${company}" class="edit-template">Edit</button> <button data-company="${company}" class="delete-template">Delete</button>`;
    templateListDiv.appendChild(div);
  });
  // Add event listeners for edit/delete
  Array.from(document.getElementsByClassName('edit-template')).forEach(btn => {
    btn.onclick = () => {
      const company = btn.getAttribute('data-company');
      chrome.storage.local.get(['templates'], res => {
        const templates = res.templates || {};
        newCompanyInput.value = company;
        newTemplateInput.value = templates[company] || '';
      });
    };
  });
  Array.from(document.getElementsByClassName('delete-template')).forEach(btn => {
    btn.onclick = () => {
      const company = btn.getAttribute('data-company');
      chrome.storage.local.get(['templates'], res => {
        const templates = res.templates || {};
        delete templates[company];
        chrome.storage.local.set({ templates }, () => renderTemplates(templates));
      });
    };
  });
}

function loadTemplates() {
  chrome.storage.local.get(['templates'], res => {
    renderTemplates(res.templates || {});
  });
}

addTemplateBtn.onclick = () => {
  const company = newCompanyInput.value.trim();
  const message = newTemplateInput.value.trim();
  if (!company || !message) return;
  chrome.storage.local.get(['templates'], res => {
    const templates = res.templates || {};
    templates[company] = message;
    chrome.storage.local.set({ templates }, () => {
      newCompanyInput.value = '';
      newTemplateInput.value = '';
      renderTemplates(templates);
    });
  });
};

loadTemplates();

// Handler for sending referral messages to new connections
const sendReferralsBtn = document.getElementById('send-referrals');
sendReferralsBtn.onclick = () => {
  chrome.runtime.sendMessage({ action: 'send-referrals' });
}; 