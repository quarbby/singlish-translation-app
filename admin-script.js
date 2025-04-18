// DOM Elements
const totalFilesEl = document.getElementById('total-files');
const completedFilesEl = document.getElementById('completed-files');
const inProgressFilesEl = document.getElementById('in-progress-files');
const overallProgressEl = document.getElementById('overall-progress');
const progressBarEl = document.getElementById('progress-bar');
const filesTableEl = document.getElementById('files-table').querySelector('tbody');
const refreshBtn = document.getElementById('refresh-btn');
const generateBtn = document.getElementById('generate-btn');
const loadingIndicator = document.getElementById('loading-indicator');

// Display loading indicator
function showLoading(isLoading = true) {
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    }
}

// Functions
async function loadManifest() {
    try {
        const response = await fetch('manifest.json');
        
        if (!response.ok) {
            throw new Error(`Failed to load manifest: ${response.status}`);
        }
        
        const manifest = await response.json();
        
        if (!manifest.files || !Array.isArray(manifest.files)) {
            throw new Error('Invalid manifest format');
        }
        
        return manifest.files;
    } catch (error) {
        console.error('Error loading manifest:', error);
        alert('Failed to load manifest.json. Make sure the file exists and is valid JSON.');
        return [];
    }
}

async function updateStatsDisplay() {
    if (!window.SheetsConnector) {
        alert('Sheets connector not available. Please make sure google_sheets_connector.js is loaded.');
        return;
    }
    
    try {
        // Get statistics from Google Sheets data
        const stats = await SheetsConnector.getAllStats();
        const { overall } = stats;
        
        // Update stats
        totalFilesEl.textContent = overall.totalFiles;
        completedFilesEl.textContent = overall.completedFiles;
        inProgressFilesEl.textContent = overall.inProgressFiles;
        
        // Update progress
        overallProgressEl.textContent = `${overall.overallProgress}%`;
        progressBarEl.style.width = `${overall.overallProgress}%`;
    } catch (error) {
        console.error('Error updating stats display:', error);
        alert('Error fetching data from Google Sheets. Please try again later.');
    }
}

async function updateFilesTable() {
    if (!window.SheetsConnector) {
        return;
    }
    
    try {
        // Get statistics from Google Sheets data
        const stats = await SheetsConnector.getAllStats();
        const { fileStats } = stats;
        
        // Clear the table
        filesTableEl.innerHTML = '';
        
        // Sort files: completed first, then in-progress, then not started
        const sortedStats = [...fileStats].sort((a, b) => {
            const aPercentage = a.totalEntries > 0 ? (a.completedEntries / a.totalEntries) : 0;
            const bPercentage = b.totalEntries > 0 ? (b.completedEntries / b.totalEntries) : 0;
            return bPercentage - aPercentage; // Descending order
        });
        
        // Populate the table
        sortedStats.forEach(fileStat => {
            const fileName = fileStat.filePath.split('/').pop();
            const percentage = fileStat.totalEntries > 0 ? 
                Math.round((fileStat.completedEntries / fileStat.totalEntries) * 100) : 0;
            
            let status, statusClass;
            if (fileStat.isComplete) {
                status = 'Complete';
                statusClass = 'status-complete';
            } else if (fileStat.completedEntries > 0) {
                status = 'In Progress';
                statusClass = 'status-in-progress';
            } else {
                status = 'Not Started';
                statusClass = 'status-not-started';
            }
            
            const lastUpdated = fileStat.lastUpdated ? 
                fileStat.lastUpdated.toLocaleString() : 'Never';
            
            // Create row
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${fileName}</td>
                <td><span class="file-status ${statusClass}">${status}</span></td>
                <td>${fileStat.completedEntries}/${fileStat.totalEntries} (${percentage}%)</td>
                <td>${lastUpdated}</td>
            `;
            
            filesTableEl.appendChild(row);
        });
    } catch (error) {
        console.error('Error updating files table:', error);
        filesTableEl.innerHTML = `<tr><td colspan="4" class="error-message">Error loading data from Google Sheets</td></tr>`;
    }
}

async function refreshData() {
    showLoading(true);
    
    try {
        // Force refresh data from Google Sheets
        if (window.SheetsConnector) {
            await SheetsConnector.fetchAllData(true);
        }
        
        // Update the display
        await Promise.all([
            updateStatsDisplay(),
            updateFilesTable(),
            calculateTranslationStats() // Add this line
        ]);
        
        // Show success message
        showStatusMessage('Data refreshed successfully', true);
    } catch (error) {
        console.error('Error refreshing data:', error);
        showStatusMessage('Error refreshing data', false);
    } finally {
        showLoading(false);
    }
}

function generateReport() {
    if (!window.SheetsConnector) {
        alert('Sheets connector not available.');
        return;
    }
    
    showLoading(true);
    
    SheetsConnector.generateHTMLReport()
        .then(reportHtml => {
            // Create a popup window with the report
            const reportWindow = window.open('', '_blank', 'width=800,height=600');
            
            if (!reportWindow) {
                alert('Pop-up was blocked. Please allow pop-ups for this site to generate reports.');
                showLoading(false);
                return;
            }
            
            reportWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Translation Project Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1, h2, h3 { color: #4361ee; }
                        .report-header { margin-bottom: 20px; }
                        .report-summary { margin-bottom: 30px; }
                        .report-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
                        th { background-color: #f2f2f2; }
                        .status-complete { 
                            background-color: rgba(76, 201, 240, 0.15);
                            color: #4cc9f0;
                            padding: 3px 8px;
                            border-radius: 12px;
                            font-weight: 500;
                        }
                        .status-in-progress { 
                            background-color: rgba(253, 126, 20, 0.15);
                            color: #fd7e14;
                            padding: 3px 8px;
                            border-radius: 12px;
                            font-weight: 500;
                        }
                        .status-not-started { 
                            background-color: rgba(229, 56, 59, 0.15);
                            color: #e5383b;
                            padding: 3px 8px;
                            border-radius: 12px;
                            font-weight: 500;
                        }
                        .print-btn { 
                            background-color: #4361ee; 
                            color: white; 
                            border: none; 
                            padding: 10px 20px; 
                            border-radius: 5px; 
                            cursor: pointer; 
                            margin-bottom: 20px;
                        }
                        .error { color: #e5383b; }
                    </style>
                </head>
                <body>
                    <button class="print-btn" onclick="window.print()">Print Report</button>
                    <h1>Translation Project Report</h1>
                    ${reportHtml}
                </body>
                </html>
            `);
            
            showLoading(false);
        })
        .catch(error => {
            console.error('Error generating report:', error);
            alert('Error generating report. Please try again later.');
            showLoading(false);
        });
}

function showStatusMessage(message, isSuccess = true) {
    const statusDiv = document.getElementById('status-message');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = isSuccess ? 'status-success' : 'status-error';
    statusDiv.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// Function to calculate and display translation progress statistics
async function calculateTranslationStats() {
    if (!window.SheetsConnector) {
        console.error('Sheets connector not available');
        return;
    }

    try {
        // Get statistics from Google Sheets data
        const stats = await SheetsConnector.getAllStats();
        const { overall } = stats;

        // Calculate remaining lines to translate
        const remainingLines = overall.totalEntries - overall.completedEntries;
        
        // Check if the HTML element exists on the page
        const remainingLinesEl = document.getElementById('remaining-lines');
        if (remainingLinesEl) {
            remainingLinesEl.textContent = remainingLines;
        }

        // Calculate estimated time to complete (assuming 2 minutes per line)
        const estimatedHours = Math.ceil((remainingLines * 2) / 60);
        const estimatedTimeEl = document.getElementById('estimated-time');
        if (estimatedTimeEl) {
            estimatedTimeEl.textContent = `${estimatedHours} hours`;
        }

        return {
            totalLines: overall.totalEntries,
            completedLines: overall.completedEntries,
            remainingLines: remainingLines,
            estimatedHours: estimatedHours
        };
    } catch (error) {
        console.error('Error calculating translation stats:', error);
        return null;
    }
}

// Event Listeners
refreshBtn.addEventListener('click', refreshData);
generateBtn.addEventListener('click', generateReport);

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.SheetsConnector) {
        alert('Sheets connector not available. Please make sure google_sheets_connector.js is loaded.');
        return;
    }
    
    showLoading(true);
    
    try {
        // Load and display data
        await Promise.all([
            updateStatsDisplay(),
            updateFilesTable()
        ]);
    } catch (error) {
        console.error('Error loading initial data:', error);
        showStatusMessage('Error loading data from Google Sheets', false);
    } finally {
        showLoading(false);
    }

    await calculateTranslationStats();
});