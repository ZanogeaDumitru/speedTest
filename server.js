const axios = require('axios');
const FormData = require('form-data');
const net = require('net');
const { Writable } = require('stream');
// Configurazione del server di test
const TEST_SERVER_HOST = 'speedtest.unidata.it'; // Sostituisci con l'host del server di test
const DOWNLOAD_URL = ' http://ipv4.download.thinkbroadband.com/100MB.zip'; // Sostituisci con un file di grandi dimensioni per il test di download
const UPLOAD_SERVER = 'https://file.io'; // Sostituisci con l'host del server per l'upload test

// Funzione per eseguire il test del ping (latenza)
function pingServer(serverHost, callback) {
    const startTime = Date.now();
    const client = new net.Socket();

    client.connect(80, serverHost, function () {
        const latency = Date.now() - startTime;
        console.log(`Ping al server ${serverHost}: ${latency} ms`);
        client.destroy();
        callback(latency);
    });

    client.on('error', function (err) {
        console.error('Errore di connessione:', err);
        client.destroy();
        callback(null, err);
    });
}

// Funzione per eseguire il test di download


const fs = require('fs');

function logResults(ping, downloadSpeed, uploadSpeed) {
    downloadSpeed = JSON.stringify(downloadSpeed, null, 2);
    uploadSpeed = JSON.stringify(uploadSpeed, null, 2)
    const logData = `Ping: ${ping} ms \n Download: ${downloadSpeed} \n Upload: ${uploadSpeed} \n `;
    fs.appendFile('speedtest.log', logData, (err) => {
        if (err) throw err;
        console.log('Risultati salvati in speedtest.log');
    });
}

function downloadTest(url, callback) {
    const startTime = Date.now();
    let downloadedBytes = 0; // Byte scaricati

    const writeStream = new Writable({
        write(chunk, encoding, callback) {
            downloadedBytes += chunk.length; // Aggiungi la lunghezza del chunk scaricato
            const duration = (Date.now() - startTime) / 1000; // Tempo in secondi
            const speedMbps = (downloadedBytes * 8) / (duration * 1000000); // Calcola la velocità in Mbps
            console.log(`Velocità di download attuale: ${speedMbps.toFixed(2)} Mbps`);
            callback(); // Chiama il callback per indicare che il chunk è stato scritto
        }
    });

    // Inizio il download
    axios({
        method: 'get',
        url: url, // Assicurati che questo sia un URL HTTPS
        responseType: 'stream' // Ottieni la risposta come stream
    })
    .then(response => {
        const totalSize = parseInt(response.headers['content-length'], 10); // Ottieni la dimensione totale in byte
        console.log(`Dimensione totale del file: ${totalSize} bytes`);

        response.data.pipe(writeStream); // Pipa i dati della risposta nel write stream

        // Gestisci l'evento end
        writeStream.on('finish', () => {
            const totalDuration = (Date.now() - startTime) / 1000; // Tempo totale in secondi
            const totalSpeedMbps = (totalSize * 8) / (totalDuration * 1000000); // Velocità totale in Mbps
            console.log(`Velocità di download totale: ${totalSpeedMbps.toFixed(2)} Mbps`);
            let data = {
                speed: totalSpeedMbps + ' Mbps',
                time: totalDuration + ' seconds',
                timeStart: new Date(startTime).toLocaleString(),
                timeEnd: new Date(Date.now()).toLocaleString(),
                bytes: downloadedBytes / 1048576 + ' MB',
                host: 'url: ' + TEST_SERVER_HOST
            }
            callback(data); // Chiama il callback finale
        });
    })
    .catch(error => {
        console.error('Errore durante il download:', error);
        callback(undefined, error); // Passa l'errore al callback
    });
}

// Funzione per eseguire il test di upload
async function uploadTest(serverHost, filePath, callback) {
    const fileSize = fs.statSync(filePath).size; // Dimensione del file in byte
    const form = new FormData(); // Crea un nuovo FormData
    const fileStream = fs.createReadStream(filePath); // Stream del file
    form.append('file', fileStream); // Aggiungi il file al form

    let uploadedBytes = 0; // Byte caricati
    const startTime = Date.now(); // Tempo di inizio


    // Aggiorna uploadedBytes ogni volta che un chunk è scritto
    fileStream.on('data', (chunk) => {
        uploadedBytes += chunk.length; // Aggiorna i byte caricati
        const duration = (Date.now() - startTime) / 1000; // Tempo in secondi
        const speedMbps = (uploadedBytes * 8) / (duration * 10000); // Calcola la velocità in Mbp
        console.log(`Velocità di upload attuale: ${speedMbps.toFixed(2)} Mbps`);
    });

    try {
        // Invio della richiesta POST a File.io
        const response = await axios.post(serverHost, form, {
            headers: {
                ...form.getHeaders(), // Includi gli headers di FormData
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const totalDuration = (Date.now() - startTime) / 1000; // Tempo totale in secondi
        const totalSpeedMbps = (fileSize * 8) / (totalDuration * 1000000); // Velocità totale in Mbps

        let data = {
            speed: totalSpeedMbps + ' Mbps',
            time: totalDuration + ' seconds',
            timeStart: new Date(startTime).toLocaleString(),
            timeEnd: new Date(Date.now()).toLocaleString(),
            bytes: fileSize / 1048576 + '  MB', // Mostra la dimensione totale del file
            host: serverHost
        };
        
        callback(data); // Passa i dati al callback
        console.log('Risposta dal server:', response.data); // Mostra la risposta del server

    } catch (error) {
        clearInterval(interval); // Ferma l'intervallo in caso di errore
        console.error('Errore durante l\'upload:', error.response?.data || error.message);
    }
}


// Funzione principale per eseguire tutti i test
function runSpeedTest() {
    console.log("Inizio dello speed test...");

    // Test di ping
    pingServer(TEST_SERVER_HOST, (pingResult, pingError) => {
        if (pingError) {
            console.log("Errore durante il test di ping:", pingError);
            return;
        }

        console.log("Test di ping completato!");

        // Test di download
        downloadTest(DOWNLOAD_URL, (downloadSpeed, downloadError) => {
            if (downloadError) {
                console.log("Errore durante il test di download:", downloadError);
                return;
            }
            console.log("Test di download completato!");
            // Test di upload
            uploadTest(UPLOAD_SERVER,'upload/testfile.txt', (uploadSpeed, uploadError) => {
                if (uploadError) return;
                console.log("Test completato!");
                logResults(pingResult, downloadSpeed, uploadSpeed);
            });
            
        });

    });


}

// Avvia il server Node.js per eseguire i test
runSpeedTest();
