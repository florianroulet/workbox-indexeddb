/*
Copyright 2017 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
const container = document.getElementById('container');
const offlineMessage = document.getElementById('offline');
const noDataMessage = document.getElementById('no-data');
const dataSavedMessage = document.getElementById('data-saved');
const saveErrorMessage = document.getElementById('save-error');
const addEventButton = document.getElementById('add-event-button');

addEventButton.addEventListener('click', addAndPostEvent);

Notification.requestPermission();

const dbPromise = createIndexedDB();

loadContentNetworkFirst();

function loadContentNetworkFirst() {
  getServerData()
  .then(dataFromNetwork => {
    updateUI(dataFromNetwork);
    saveEventDataLocally(dataFromNetwork)
    .then(() => {
      setLastUpdated(new Date());
      messageDataSaved();
    }).catch(err => {
      messageSaveError();
      console.warn(err);
    });
  }).catch(err => {
    console.log('Network requests have failed, this is expected if offline');
    getLocalEventData()
    .then(offlineData => {
      if (!offlineData.length) {
        messageNoData();
      } else {
        messageOffline();
        updateUI(offlineData);
      }
    });
  });
}

/* Network functions */

function getServerData() {
  return fetch('api/getAll').then(response => {
    if (!response.ok) {
      throw Error(response.statusText);
    }
    return response.json();
  });
}

function addAndPostEvent(e) {
  e.preventDefault();
  const data = {
    id: Date.now(),
    title: document.getElementById('title').value,
    date: document.getElementById('date').value,
    city: document.getElementById('city').value,
    note: document.getElementById('note').value
  };
  updateUI([data]);
  saveEventDataLocally([data]);
  const headers = new Headers({'Content-Type': 'application/json'});
  const body = JSON.stringify(data);
  return fetch('api/add', {
    method: 'POST',
    headers: headers,
    body: body
  });
}

/* UI functions */

function updateUI(events) {
  events.forEach(event => {
    const item =
      `<li class="card">
         <div class="card-text">
           <h2>${event.title}</h2>
           <h4>${event.date}</h4>
           <h4>${event.city}</h4>
           <p>${event.note}</p>
           <button class="delete raised button ripple" data-id="${event.id}">DELETE</button>
         </div>
       </li>`;
    container.insertAdjacentHTML('beforeend', item);
  });
  Array.prototype.forEach.call(document.getElementsByClassName("delete"), deleteBtn => {
    deleteBtn.addEventListener('click', deleteEvent)
  });
}

function deleteFromUI(liCardElement) {
    liCardElement.remove();
}

function deleteEvent(e) {
  e.preventDefault();
  let id = this.getAttribute("data-id");
  console.log("deleted id : ", id);
  const data = {
      id: id
  };
  deleteEventDataLocally(id);
  deleteFromUI(this.parentElement.parentElement );
  const headers = new Headers({'Content-Type': 'application/json'});
  const body = JSON.stringify(data);
  return fetch('api/delete', {
      method: 'POST',
      headers: headers,
      body: body
  });
}

function messageOffline() {
  // alert user that data may not be current
  const lastUpdated = getLastUpdated();
  if (lastUpdated) {
    offlineMessage.textContent += ' Last fetched server data: ' + lastUpdated;
  }
  offlineMessage.style.display = 'block';
}

function messageNoData() {
  // alert user that there is no data available
  noDataMessage.style.display = 'block';
}

function messageDataSaved() {
  // alert user that data has been saved for offline
  const lastUpdated = getLastUpdated();
  if (lastUpdated) {dataSavedMessage.textContent += ' on ' + lastUpdated;}
  dataSavedMessage.style.display = 'block';
}

function messageSaveError() {
  // alert user that data couldn't be saved offline
  saveErrorMessage.style.display = 'block';
}

/* Storage functions */

function getLastUpdated() {
  return localStorage.getItem('lastUpdated');
}

function setLastUpdated(date) {
  localStorage.setItem('lastUpdated', date);
}

function createIndexedDB() {
  if (!('indexedDB' in window)) {return null;}
  return idb.open('dashboardr', 1, function(upgradeDb) {
      if (!upgradeDb.objectStoreNames.contains('events')) {
          const eventsOS = upgradeDb.createObjectStore('events', {keyPath: 'id'});
      }
  });
}

function saveEventDataLocally(events) {
  if (!('indexedDB' in window)) {return null;}
  return dbPromise.then(db => {
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    return Promise.all(events.map(event => store.put(event)))
      .catch(() => {
              tx.abort();
          throw Error('Events were not added to the store');
      });
  });
}

function deleteEventDataLocally(eventId) {
    if (!('indexedDB' in window)) {return null;}
    return dbPromise.then(db => {
        const tx = db.transaction('events', 'readwrite');
        const store = tx.objectStore('events');
        return store.delete(eventId)
            .catch(() => {
                tx.abort();
                throw Error('Events were not deleted from the store');
            });
    });
}

function getLocalEventData() {
  if (!('indexedDB' in window)) {return null;}
    return dbPromise.then(db => {
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      return store.getAll();
  });
}

window.addEventListener('online', () => {
  container.innerHTML = '';
  loadContentNetworkFirst();
});