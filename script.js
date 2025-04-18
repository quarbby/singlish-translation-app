// DOM Elements
const loadingSection = document.getElementById('loading-section');
const translationSection = document.getElementById('translation-section');
const sentenceDisplay = document.getElementById('sentence-display');
const sourceInfo = document.getElementById('source-info');
const contextContainer = document.getElementById('context-container');
const translationInput = document.getElementById('translation-input');
const nextBtn = document.getElementById('next-btn');
const skipBtn = document.getElementById('skip-btn');
const noTranslationBtn = document.getElementById('no-translation-btn');
const progressCounter = document.getElementById('progress-counter');
const progressBar = document.getElementById('progress-bar');
const statusMessage = document.getElementById('status-message');

// App state
let sentences = [];
let sentenceSources = [];
let currentIndex = 0;
let sessionId = new Date().toISOString().replace(/[:.]/g, '-');
let userName = '';
let selectedFile = '';

// Google Apps Script Web App URL - YOU MUST REPLACE THIS WITH YOUR OWN
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6LtnwxfbaLBr5YK5-VEXEtcMDbHQJjt2itsnOoZUfP0NlZoJeQ6zFNzyqO8KHkIRgFA/exec';

// Particle meanings mapping
const particleMeanings = {
    'ah': [
        'Signal continuation',
        'Soften command',
        'Marks a question expecting agreement/response'
    ],
    'bah': [
        'Marks uncertainty'
    ],
    'hor': [
        'Assert and elicit support',
        'Reduce Harshness'
    ],
    'lah': [
        'Indicates solidarity, familiarity and informality',
        'Appeal for accommodation'
    ],
    'leh': [
        'Marks question involving comparison',
        'Equivalent to "what about"',
        'Tentative suggestion or request'
    ],
    'lor': [
        'Indicates a sense of obviousness and resignation'
    ],
    'mah': [
        'Indicate obviousness'
    ],
    'meh': [
        'Marks a question involving scepticism'
    ],
    'sia': [
        'Serves as intensifier',
        'Marker of casual speech denoting youth identity'
    ],
    'what/wor': [
        'Indicate information is obvious, contradicting previous assertion'
    ]
};


// Get list of input files from manifest.json
async function getInputFiles() {
    try {
        // Try to fetch the manifest.json file
        const response = await fetch('manifest.json');
        
        if (!response.ok) {
            console.error(`Failed to load manifest.json: ${response.status} ${response.statusText}`);
            // Fallback to default files if manifest doesn't exist
            return ['inputs/btohqsg_messages.csv'];
        }
        
        const manifest = await response.json();
        
        if (!manifest.files || !Array.isArray(manifest.files) || manifest.files.length === 0) {
            console.error('Manifest does not contain valid files array');
            return ['inputs/btohqsg_messages.csv'];
        }
        
        // If randomization is requested, select a single random file
        if (selectedFile) {
            return [selectedFile];
        }
        
        return manifest.files;
    } catch (error) {
        console.error('Error loading manifest.json:', error);
        // Fallback to default file
        return ['inputs/btohqsg_messages.csv'];
    }
}

// Load the completion tracker script
function loadCompletionTracker() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'completion_tracker.js';
        script.onload = () => {
            // Initialize the tracker once loaded
            window.CompletionTracker.init();
            resolve();
        };
        script.onerror = () => {
            console.error('Failed to load completion tracker');
            reject(new Error('Failed to load completion tracker'));
        };
        document.body.appendChild(script);
    });
}

// Function to randomly select one file from manifest, prioritizing uncompleted files
async function selectRandomFile() {
    try {
        const response = await fetch('manifest.json');
        
        if (!response.ok) {
            return 'inputs/btohqsg_messages.csv';
        }
        
        const manifest = await response.json();
        
        if (!manifest.files || !Array.isArray(manifest.files) || manifest.files.length === 0) {
            return 'inputs/btohqsg_messages.csv';
        }
        
        // If we have the CompletionTracker, use it to select a file
        if (window.CompletionTracker) {
            const nextFile = window.CompletionTracker.getNextAvailableFile(manifest.files);
            
            // If all files are completed, just pick a random one
            if (nextFile === null) {
                const randomIndex = Math.floor(Math.random() * manifest.files.length);
                return manifest.files[randomIndex];
            }
            
            return nextFile;
        } else {
            // Fallback to random selection if tracker not available
            const randomIndex = Math.floor(Math.random() * manifest.files.length);
            return manifest.files[randomIndex];
        }
    } catch (error) {
        console.error('Error selecting random file:', error);
        return 'inputs/btohqsg_messages.csv';
    }
}

// Load sentences from all input files
async function loadAllSentences() {
    const inputFiles = await getInputFiles();
    
    try {
        for (const file of inputFiles) {
            const response = await fetch(file);
            
            if (!response.ok) {
                console.error(`Failed to load ${file}: ${response.status} ${response.statusText}`);
                continue;
            }
            
            const csvText = await response.text();
            
            // Parse CSV
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    if (results.data && results.data.length > 0) {
                        // Check if the CSV has a "text" column (adjusted from "Sentence" to match your CSV structure)
                        const textColumn = results.meta.fields.includes('text') ? 'text' : 
                                          results.meta.fields.includes('Sentence') ? 'Sentence' : null;
                        
                        if (!textColumn) {
                            console.error(`${file} does not contain a "text" or "Sentence" column.`);
                            return;
                        }
                        
                        // Add sentences from this file
                        results.data.forEach(row => {
                            if (row[textColumn] && typeof row[textColumn] === 'string' && row[textColumn].trim() !== '') {
                                sentences.push(row[textColumn]);
                                sentenceSources.push(file);
                            }
                        });
                    }
                },
                error: function(error) {
                    console.error(`Error parsing ${file}: ${error.message}`);
                }
            });
        }
        
        // Check if we loaded any sentences
        if (sentences.length === 0) {
            alert('No sentences found in any of the input files.');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error loading sentences:', error);
        alert('Error loading sentences: ' + error.message);
        return false;
    }
}

// Initialize the app after name entry
async function initialize() {
    const loadingSection = document.getElementById('loading-section');
    const translationSection = document.getElementById('translation-section');
    
    // Show loading section
    loadingSection.style.display = 'flex';
    
    try {
        // Try to load the completion tracker
        await loadCompletionTracker();
    } catch (error) {
        console.warn('Completion tracker not available, continuing without tracking');
    }
    
    // First select a random file
    selectedFile = await selectRandomFile();
    console.log('Selected file:', selectedFile);
    
    // Load all sentences
    const success = await loadAllSentences();
    
    if (!success) {
        loadingSection.innerHTML = `
            <h2 style="color: #dc3545;"><i class="fas fa-exclamation-circle"></i> Error</h2>
            <p>Failed to load sentences. Please try again later.</p>
            <p>Make sure you have generated the manifest.json file using the manifest-generator.js script.</p>
            <button class="btn" onclick="window.location.reload()">Try Again</button>
        `;
        return;
    }
    
    // Hide loading, show translation section
    loadingSection.style.display = 'none';
    translationSection.style.display = 'block';
    
    // Update display
    updateProgressDisplay();
    displayCurrentSentence();
}

// Handle name submission and start app
document.getElementById('start-btn').addEventListener('click', function() {
    const nameInput = document.getElementById('user-name-input');
    const name = nameInput.value.trim();
    
    if (name === '') {
        alert('Please enter your name before continuing.');
        nameInput.focus();
        return;
    }
    
    // Store the user name
    userName = name;
    
    // Hide the modal
    document.getElementById('name-modal').style.display = 'none';
    
    // Initialize the app
    initialize();
});

// Also allow pressing Enter on the name input
document.getElementById('user-name-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        document.getElementById('start-btn').click();
    }
});

// Display current sentence and previous context
function displayCurrentSentence() {
    // Display current sentence
    sentenceDisplay.textContent = sentences[currentIndex];
    sourceInfo.textContent = `Source: ${sentenceSources[currentIndex]}`;
    translationInput.value = '';
    translationInput.focus();
    
    // Reset particle form for each new sentence
    resetParticleForm();
    
    // Display previous context (up to 2 sentences)
    updateContextDisplay();
}

// Update the context display with previous sentences
function updateContextDisplay() {
    // Clear existing context
    contextContainer.innerHTML = '';
    
    // If we're at the beginning or there's only one sentence
    if (currentIndex <= 0 || sentences.length <= 1) {
        contextContainer.innerHTML = '<div class="empty-context">No previous sentences available</div>';
        return;
    }
    
    // Show up to 2 previous sentences
    const startIdx = Math.max(0, currentIndex - 2);
    for (let i = startIdx; i < currentIndex; i++) {
        const contextDiv = document.createElement('div');
        contextDiv.className = 'context-card';
        contextDiv.textContent = sentences[i];
        contextContainer.appendChild(contextDiv);
    }
}

// Update the progress display
function updateProgressDisplay() {
    progressCounter.textContent = `${currentIndex + 1} of ${sentences.length} sentences`;
    const progressPercentage = ((currentIndex) / sentences.length) * 100;
    progressBar.style.width = `${progressPercentage}%`;
}

// Show status message
function showStatus(message, isSuccess = true) {
    statusMessage.textContent = message;
    statusMessage.className = isSuccess ? 
        'status-message status-success' : 
        'status-message status-error';
    
    // Remove hidden class to show the message
    statusMessage.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 3000);
}

// Function to update meaning options based on selected particle
function updateMeaningOptions(particle) {
    const meaningsContainer = document.getElementById('particle-meanings');
    const otherParticleInput = document.getElementById('particle-other');
    const variationDiv = document.getElementById('particle-variation-div');
    
    if (!meaningsContainer || !otherParticleInput) {
        console.error('Particle elements not found');
        return;
    }
    
    // Clear existing options
    meaningsContainer.innerHTML = '';
    
    // Handle "Others" selection
    if (particle === 'others') {
        otherParticleInput.style.display = 'block';
        variationDiv.style.display = 'none'; // Hide variation for "Others"
        
        // Create a default "Others" meaning option
        const meaningDiv = document.createElement('div');
        meaningDiv.style.marginBottom = '10px';
        meaningDiv.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="radio" name="meaning" value="others" style="margin-right: 5px;" checked> Others
            </label>
        `;
        meaningsContainer.appendChild(meaningDiv);
        
        // Show the other meaning input
        document.getElementById('meaning-other').style.display = 'block';
        return;
    }
    
    // Handle "No Particle" selection
    if (particle === 'no_particle') {
        otherParticleInput.style.display = 'none';
        variationDiv.style.display = 'none'; // Hide variation for "No Particle"
        meaningsContainer.innerHTML = '<div class="empty-meanings" style="font-style: italic; color: #adb5bd;">No particle selected</div>';
        document.getElementById('meaning-other').style.display = 'none';
        return;
    }
    
    // Handle standard particles (hor, lah, lor)
    if (particle === 'hor' || particle === 'lah' || particle === 'lor') {
        // Show variation input for standard particles
        variationDiv.style.display = 'block';
    } else {
        variationDiv.style.display = 'none';
    }
    
    // Hide the "Other" particle input for standard particles
    otherParticleInput.style.display = 'none';
    
    // Get meanings for the selected particle
    const meanings = particleMeanings[particle] || [];
    
    // Create meaning options
    if (meanings.length > 0) {
        meanings.forEach((meaning, index) => {
            const meaningDiv = document.createElement('div');
            meaningDiv.style.marginBottom = '10px';
            meaningDiv.innerHTML = `
                <label style="display: flex; align-items: center; cursor: pointer;">
                    <input type="radio" name="meaning" value="${encodeURIComponent(meaning)}" style="margin-right: 5px;" ${index === 0 ? 'checked' : ''}> ${meaning}
                </label>
            `;
            meaningsContainer.appendChild(meaningDiv);
        });
    }
    
    // Always add "Others" option
    const othersDiv = document.createElement('div');
    othersDiv.style.marginBottom = '10px';
    othersDiv.innerHTML = `
        <label style="display: flex; align-items: center; cursor: pointer;">
            <input type="radio" name="meaning" value="others" style="margin-right: 5px;"> Others
        </label>
    `;
    meaningsContainer.appendChild(othersDiv);
    
    // Handle the Other meaning input visibility
    document.querySelectorAll('input[name="meaning"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById('meaning-other').style.display = 
                this.value === 'others' ? 'block' : 'none';
        });
    });
    
    // Initially hide the other meaning input
    document.getElementById('meaning-other').style.display = 'none';
}


// Set up particle selection change handler
document.querySelectorAll('input[name="particle"]').forEach(radio => {
    radio.addEventListener('change', function() {
        updateMeaningOptions(this.value);
    });
});

// Reset the particle selection form
function resetParticleForm() {
    // Reset particle selection to "No Particle"
    const noParticleRadio = document.querySelector('input[name="particle"][value="no_particle"]');
    if (noParticleRadio) {
        noParticleRadio.checked = true;
    }
    
    // Clear any "Other" particle input
    const particleOtherInput = document.getElementById('particle-other');
    if (particleOtherInput) {
        particleOtherInput.value = '';
        particleOtherInput.style.display = 'none';
    }
    
    // Clear the variation input
    const variationInput = document.getElementById('particle-variation');
    if (variationInput) {
        variationInput.value = '';
    }
    
    // Hide the variation div
    const variationDiv = document.getElementById('particle-variation-div');
    if (variationDiv) {
        variationDiv.style.display = 'none';
    }
    
    // Reset meaning selection
    updateMeaningOptions('no_particle');
    
    // Clear any "Other" meaning input
    const meaningOtherInput = document.getElementById('meaning-other');
    if (meaningOtherInput) {
        meaningOtherInput.value = '';
        meaningOtherInput.style.display = 'none';
    }
}

// Submit translation to Google Sheet
async function submitTranslation(original, translation, status = 'translated') {
    const nextBtn = document.getElementById('next-btn');
    const skipBtn = document.getElementById('skip-btn');
    const noTranslationBtn = document.getElementById('no-translation-btn');
    
    // Disable buttons while submitting
    nextBtn.disabled = true;
    skipBtn.disabled = true;
    noTranslationBtn.disabled = true;
    
    try {
        // Make sure we have a userName, even if modal was bypassed
        if (!userName || userName.trim() === '') {
            userName = 'Anonymous User';
        }
        
        // Get particle information
        let particle = "none";
        const selectedParticle = document.querySelector('input[name="particle"]:checked');
        
        if (selectedParticle) {
            particle = selectedParticle.value;
            
            // If "others" is selected, get the value from the other input
            if (particle === "others") {
                const otherParticleValue = document.getElementById('particle-other').value.trim();
                if (otherParticleValue) {
                    particle = otherParticleValue;
                }
            }
            // If it's a standard particle (hor, lah, lor), get the variation
            else if (particle === "hor" || particle === "lah" || particle === "lor") {
                const variationValue = document.getElementById('particle-variation').value.trim();
                if (variationValue) {
                    particle = particle + " (" + variationValue + ")";
                }
            }
        }
        
        // Get particle meaning
        let particleMeaning = "";
        const selectedMeaning = document.querySelector('input[name="meaning"]:checked');
        
        if (selectedMeaning) {
            particleMeaning = decodeURIComponent(selectedMeaning.value);
            
            // If "others" is selected, get the value from the other meaning input
            if (particleMeaning === "others") {
                const otherMeaningValue = document.getElementById('meaning-other').value.trim();
                if (otherMeaningValue) {
                    particleMeaning = otherMeaningValue;
                }
            }
        }
        
        // Prepare data for Google Apps Script
        const data = {
            sessionId: sessionId,
            userName: userName,
            source: sentenceSources[currentIndex],
            sentence: original,
            translation: translation,
            status: status,
            particle: particle,
            particleMeaning: particleMeaning,
            timestamp: new Date().toISOString()
        };
        
        // Use fetch with CORS mode to submit to Google Apps Script
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // This means we won't be able to read the response
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
            body: JSON.stringify(data)
        });
        
        // Show success message
        showStatus('Translation saved successfully!', true);
        return true;
    } catch (error) {
        console.error('Error submitting translation:', error);
        showStatus('Error saving translation. Continuing anyway.', false);
        return false;
    } finally {
        // Re-enable buttons
        nextBtn.disabled = false;
        skipBtn.disabled = false;
        noTranslationBtn.disabled = false;
    }
}

// Handle next button click
nextBtn.addEventListener('click', async function() {
    const translation = translationInput.value.trim();
    
    if (translation === '') {
        alert('Please enter a translation before continuing.');
        return;
    }
    
    // Submit the translation to Google Sheet
    await submitTranslation(sentences[currentIndex], translation, 'translated');
    
    moveToNext();
});

// Handle skip button click
skipBtn.addEventListener('click', function() {
    // Record skipped sentences with empty translation
    submitTranslation(sentences[currentIndex], '', 'skipped');
    moveToNext();
});

// Handle no translation needed button click
noTranslationBtn.addEventListener('click', function() {
    // Record as not needing translation
    submitTranslation(sentences[currentIndex], 'No Translation Needed', 'no_translation_needed');
    moveToNext();
});

// Move to next sentence or finish
function moveToNext() {
    // Update completion tracking if available
    if (window.CompletionTracker) {
        window.CompletionTracker.updateFileStatus(
            selectedFile,
            sentences.length, 
            currentIndex + 1
        );
    }
    
    currentIndex++;
    
    if (currentIndex < sentences.length) {
        updateProgressDisplay();
        displayCurrentSentence();
    } else {
        // All done, show completion message
        const translationSection = document.getElementById('translation-section');
        
        // Prepare completion report if tracker is available
        let completionReport = '';
        if (window.CompletionTracker) {
            completionReport = window.CompletionTracker.getCompletionReport();
        }
        
        translationSection.innerHTML = `
            <h2 style="color: #20bf6b; text-align: center;">
                <i class="fas fa-check-circle"></i> Thank you!
            </h2>
            <p style="text-align: center;">
                You've completed all the translations for this file. Your contributions are greatly appreciated!
            </p>
            <div style="margin-top: 30px;">
                ${completionReport}
            </div>
            <div style="margin-top: 30px; text-align: center;">
                <button class="btn" onclick="window.location.reload()">
                    <i class="fas fa-sync"></i> Translate Another File
                </button>
            </div>
        `;
    }
}

// We don't auto-initialize anymore - wait for name input
// Set focus on the name input when page loads
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('user-name-input').focus();
});