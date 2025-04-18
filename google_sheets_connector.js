/**
 * Google Sheets Connector for Translation Project
 * This script connects to Google Sheets to retrieve translation data
 * and calculate file completion statistics.
 */

const SheetsConnector = {
    // The URL of your Google Apps Script web app that will serve as an API to your Google Sheet
    // YOU MUST REPLACE THIS WITH YOUR OWN
    API_URL: 'https://script.google.com/macros/s/AKfycby6LtnwxfbaLBr5YK5-VEXEtcMDbHQJjt2itsnOoZUfP0NlZoJeQ6zFNzyqO8KHkIRgFA/exec',
    
    // Cache for the data to avoid too many requests
    cache: {
        data: null,
        timestamp: null,
        // Cache expires after 1 minute
        CACHE_DURATION: 60 * 1000
    },
    
    /**
     * Fetch all translation data from Google Sheets
     * @param {boolean} forceRefresh - Force a refresh bypassing cache
     * @returns {Promise<Array>} - Promise resolving to array of translation entries
     */
    fetchAllData: async function(forceRefresh = false) {
        // Check if we have cached data that's still valid
        const now = new Date().getTime();
        if (!forceRefresh && this.cache.data && this.cache.timestamp && 
            (now - this.cache.timestamp < this.cache.CACHE_DURATION)) {
            return this.cache.data;
        }
        
        try {
            // Add a timestamp parameter to prevent caching by the browser
            const url = `${this.API_URL}?action=getAllData&t=${Date.now()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache the data
            this.cache.data = data;
            this.cache.timestamp = now;
            
            return data;
        } catch (error) {
            console.error('Error fetching data from Google Sheets:', error);
            throw error;
        }
    },
    
    /**
     * Get all unique file paths from translation data
     * @returns {Promise<Array>} - Promise resolving to array of file paths
     */
    getFileList: async function() {
        try {
            const data = await this.fetchAllData();
            
            // Extract unique file paths
            const filePaths = data.map(entry => entry.source);
            const uniqueFilePaths = [...new Set(filePaths)];
            
            return uniqueFilePaths;
        } catch (error) {
            console.error('Error getting file list:', error);
            return [];
        }
    },
    
    /**
     * Calculate statistics for a specific file
     * @param {string} filePath - Path to the file
     * @returns {Promise<Object>} - Promise resolving to file statistics
     */
    getFileStats: async function(filePath) {
        try {
            const data = await this.fetchAllData();
            
            // Filter entries for this file
            const fileEntries = data.filter(entry => entry.source === filePath);
            
            // Count sentences with non-empty translations
            const translatedEntries = fileEntries.filter(entry => 
                entry.translation && entry.translation.trim() !== '' && 
                entry.status !== 'skipped'
            );
            
            // Count sentences marked as "No Translation Needed"
            const noTranslationNeededEntries = fileEntries.filter(entry => 
                entry.status === 'no_translation_needed'
            );
            
            // Both translated and "no translation needed" count as completed
            const completedEntries = translatedEntries.length + noTranslationNeededEntries.length;
            
            // Get the most recent update timestamp
            let lastUpdated = null;
            if (fileEntries.length > 0) {
                const timestamps = fileEntries.map(entry => new Date(entry.timestamp || 0).getTime());
                lastUpdated = new Date(Math.max(...timestamps));
            }
            
            return {
                filePath: filePath,
                totalEntries: fileEntries.length,
                translatedEntries: translatedEntries.length,
                noTranslationNeededEntries: noTranslationNeededEntries.length,
                completedEntries: completedEntries,
                lastUpdated: lastUpdated,
                isComplete: completedEntries >= fileEntries.length && fileEntries.length > 0
            };
        } catch (error) {
            console.error(`Error getting stats for file ${filePath}:`, error);
            return {
                filePath: filePath,
                totalEntries: 0,
                translatedEntries: 0,
                noTranslationNeededEntries: 0,
                completedEntries: 0,
                lastUpdated: null,
                isComplete: false
            };
        }
    },
    
    /**
     * Get statistics for all files
     * @returns {Promise<Object>} - Promise resolving to object with file stats and overall stats
     */
    getAllStats: async function() {
        try {
            const filePaths = await this.getFileList();
            const fileStats = [];
            
            // Get stats for each file
            for (const filePath of filePaths) {
                const stats = await this.getFileStats(filePath);
                fileStats.push(stats);
            }
            
            // Calculate overall stats
            let totalEntries = 0;
            let totalCompleted = 0;
            let completedFiles = 0;
            
            fileStats.forEach(stats => {
                totalEntries += stats.totalEntries;
                totalCompleted += stats.completedEntries;
                if (stats.isComplete) {
                    completedFiles++;
                }
            });
            
            const overallProgress = totalEntries > 0 ? 
                Math.round((totalCompleted / totalEntries) * 100) : 0;
            
            return {
                fileStats: fileStats,
                overall: {
                    totalFiles: filePaths.length,
                    completedFiles: completedFiles,
                    inProgressFiles: filePaths.length - completedFiles,
                    totalEntries: totalEntries,
                    completedEntries: totalCompleted,
                    overallProgress: overallProgress
                }
            };
        } catch (error) {
            console.error('Error getting all stats:', error);
            return {
                fileStats: [],
                overall: {
                    totalFiles: 0,
                    completedFiles: 0,
                    inProgressFiles: 0,
                    totalEntries: 0,
                    completedEntries: 0,
                    overallProgress: 0
                }
            };
        }
    },
    
    /**
     * Generate an HTML report of translation progress
     * @returns {Promise<string>} - Promise resolving to HTML report
     */
    generateHTMLReport: async function() {
        try {
            const stats = await this.getAllStats();
            const { fileStats, overall } = stats;
            
            let html = `
                <div class="report-header">
                    <h2>Translation Project Report</h2>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="report-summary">
                    <h3>Overall Progress: ${overall.overallProgress}%</h3>
                    <p>Files: ${overall.completedFiles} completed out of ${overall.totalFiles} total</p>
                    <p>Sentences: ${overall.completedEntries} translated out of ${overall.totalEntries} total</p>
                </div>
                
                <div class="report-details">
                    <h3>File Details</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Progress</th>
                                <th>Status</th>
                                <th>Last Updated</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            // Sort files by completion percentage (descending)
            const sortedStats = [...fileStats].sort((a, b) => {
                const aPercentage = a.totalEntries > 0 ? (a.completedEntries / a.totalEntries) : 0;
                const bPercentage = b.totalEntries > 0 ? (b.completedEntries / b.totalEntries) : 0;
                return bPercentage - aPercentage;
            });
            
            // Add rows for each file
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
                
                html += `
                    <tr>
                        <td>${fileName}</td>
                        <td>${fileStat.completedEntries}/${fileStat.totalEntries} (${percentage}%)</td>
                        <td><span class="${statusClass}">${status}</span></td>
                        <td>${lastUpdated}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
            
            return html;
        } catch (error) {
            console.error('Error generating HTML report:', error);
            return `<div class="error">Error generating report: ${error.message}</div>`;
        }
    }
};

// Export the SheetsConnector
window.SheetsConnector = SheetsConnector;