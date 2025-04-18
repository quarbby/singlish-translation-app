/**
 * Completion Tracker for Translation Helper
 * 
 * This script manages a log of which files have been processed
 * and tracks completion status of translations.
 */

// LocalStorage key constants
const COMPLETED_FILES_KEY = 'translated_files';
const COMPLETION_DATA_KEY = 'completion_data';
const LAST_UPDATED_KEY = 'completion_last_updated';

// Track file completion status
const CompletionTracker = {
    /**
     * Initialize the completion tracker
     */
    init: function() {
        // Initialize if not exists
        if (!localStorage.getItem(COMPLETED_FILES_KEY)) {
            localStorage.setItem(COMPLETED_FILES_KEY, JSON.stringify([]));
        }
        
        if (!localStorage.getItem(COMPLETION_DATA_KEY)) {
            localStorage.setItem(COMPLETION_DATA_KEY, JSON.stringify({}));
        }
    },
    
    /**
     * Get the list of completed files
     * @returns {Array} - Array of completed file paths
     */
    getCompletedFiles: function() {
        return JSON.parse(localStorage.getItem(COMPLETED_FILES_KEY) || '[]');
    },
    
    /**
     * Get detailed completion data
     * @returns {Object} - Completion data object
     */
    getCompletionData: function() {
        return JSON.parse(localStorage.getItem(COMPLETION_DATA_KEY) || '{}');
    },
    
    /**
     * Mark a file as completed or partially completed
     * @param {string} filePath - Path to the file
     * @param {number} totalSentences - Total sentence count in the file
     * @param {number} completedSentences - Number of sentences completed
     */
    updateFileStatus: function(filePath, totalSentences, completedSentences) {
        const completionData = this.getCompletionData();
        const completedFiles = this.getCompletedFiles();
        
        // Update completion data
        completionData[filePath] = {
            total: totalSentences,
            completed: completedSentences,
            lastUpdated: new Date().toISOString()
        };
        
        // If all sentences are completed, add to completed files list
        if (completedSentences >= totalSentences && !completedFiles.includes(filePath)) {
            completedFiles.push(filePath);
        }
        // If not all completed but in completed list, remove it
        else if (completedSentences < totalSentences && completedFiles.includes(filePath)) {
            const index = completedFiles.indexOf(filePath);
            if (index > -1) {
                completedFiles.splice(index, 1);
            }
        }
        
        // Save back to localStorage
        localStorage.setItem(COMPLETED_FILES_KEY, JSON.stringify(completedFiles));
        localStorage.setItem(COMPLETION_DATA_KEY, JSON.stringify(completionData));
        localStorage.setItem(LAST_UPDATED_KEY, new Date().toISOString());
    },
    
    /**
     * Get the next available file that needs translation
     * @param {Array} allFiles - All files from manifest.json
     * @returns {string|null} - Next file path or null if all completed
     */
    getNextAvailableFile: function(allFiles) {
        const completedFiles = this.getCompletedFiles();
        
        // Filter out completed files
        const availableFiles = allFiles.filter(file => !completedFiles.includes(file));
        
        if (availableFiles.length === 0) {
            return null; // All files are completed
        }
        
        // Get a random file from available files
        const randomIndex = Math.floor(Math.random() * availableFiles.length);
        return availableFiles[randomIndex];
    },
    
    /**
     * Calculate overall completion percentage
     * @returns {number} - Percentage of completion (0-100)
     */
    getOverallCompletion: function() {
        const completionData = this.getCompletionData();
        let totalSentences = 0;
        let totalCompleted = 0;
        
        for (const file in completionData) {
            if (completionData.hasOwnProperty(file)) {
                totalSentences += completionData[file].total;
                totalCompleted += completionData[file].completed;
            }
        }
        
        if (totalSentences === 0) {
            return 0;
        }
        
        return Math.round((totalCompleted / totalSentences) * 100);
    },
    
    /**
     * Check if all files are completed
     * @param {Array} allFiles - All files from manifest.json
     * @returns {boolean} - True if all files are completed
     */
    areAllFilesCompleted: function(allFiles) {
        const completedFiles = this.getCompletedFiles();
        return completedFiles.length === allFiles.length;
    },
    
    /**
     * Get completion status report
     * @returns {string} - HTML formatted report
     */
    getCompletionReport: function() {
        const completionData = this.getCompletionData();
        const completedFiles = this.getCompletedFiles();
        const lastUpdated = localStorage.getItem(LAST_UPDATED_KEY);
        
        let report = `<h3>Translation Completion Status</h3>`;
        
        if (lastUpdated) {
            report += `<p><small>Last updated: ${new Date(lastUpdated).toLocaleString()}</small></p>`;
        }
        
        report += `<p>Overall completion: ${this.getOverallCompletion()}%</p>`;
        report += `<p>Files completed: ${completedFiles.length}</p>`;
        
        if (Object.keys(completionData).length > 0) {
            report += `<h4>File Details:</h4>`;
            report += `<table style="width:100%; border-collapse: collapse;">`;
            report += `<tr style="background-color:#f2f2f2;">
                        <th style="padding:8px; text-align:left; border:1px solid #ddd;">File</th>
                        <th style="padding:8px; text-align:left; border:1px solid #ddd;">Progress</th>
                        <th style="padding:8px; text-align:left; border:1px solid #ddd;">Status</th>
                      </tr>`;
            
            for (const file in completionData) {
                if (completionData.hasOwnProperty(file)) {
                    const data = completionData[file];
                    const percentage = Math.round((data.completed / data.total) * 100);
                    const fileName = file.split('/').pop();
                    const status = percentage === 100 ? 'Complete' : 'In Progress';
                    const statusColor = percentage === 100 ? '#4cc9f0' : '#fd7e14';
                    
                    report += `<tr>
                                <td style="padding:8px; text-align:left; border:1px solid #ddd;">${fileName}</td>
                                <td style="padding:8px; text-align:left; border:1px solid #ddd;">
                                    ${data.completed}/${data.total} (${percentage}%)
                                </td>
                                <td style="padding:8px; text-align:left; border:1px solid #ddd; color:${statusColor}; font-weight:bold;">
                                    ${status}
                                </td>
                              </tr>`;
                }
            }
            
            report += `</table>`;
        }
        
        return report;
    },
    
    /**
     * Clear all completion data
     */
    clearAll: function() {
        localStorage.removeItem(COMPLETED_FILES_KEY);
        localStorage.removeItem(COMPLETION_DATA_KEY);
        localStorage.removeItem(LAST_UPDATED_KEY);
        this.init();
    }
};

// Export the CompletionTracker
window.CompletionTracker = CompletionTracker;