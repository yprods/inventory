/**
 * Deep Search JavaScript
 */

let searchTimeout = null;

document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchTerm');
    if (searchInput) {
        // Auto-suggestions
        searchInput.addEventListener('input', function(e) {
            const term = e.target.value.trim();
            if (term.length >= 2) {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    loadSuggestions(term);
                }, 300);
            } else {
                hideSuggestions();
            }
        });
        
        // Hide suggestions on blur
        searchInput.addEventListener('blur', function() {
            setTimeout(hideSuggestions, 200);
        });
    }
});

async function loadSuggestions(term) {
    try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(term)}`);
        const data = await response.json();
        
        if (data.success && data.suggestions) {
            showSuggestions(data.suggestions);
        }
    } catch (error) {
        console.error('Error loading suggestions:', error);
    }
}

function showSuggestions(suggestions) {
    const suggestionsDiv = document.getElementById('suggestions');
    if (!suggestionsDiv) return;
    
    if (suggestions.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    suggestionsDiv.innerHTML = suggestions.map(suggestion => `
        <a href="#" class="list-group-item list-group-item-action" onclick="selectSuggestion('${suggestion}'); return false;">
            ${suggestion}
        </a>
    `).join('');
    
    suggestionsDiv.style.display = 'block';
}

function hideSuggestions() {
    const suggestionsDiv = document.getElementById('suggestions');
    if (suggestionsDiv) {
        suggestionsDiv.style.display = 'none';
    }
}

function selectSuggestion(suggestion) {
    document.getElementById('searchTerm').value = suggestion;
    hideSuggestions();
    performDeepSearch(null);
}

async function performDeepSearch(event) {
    if (event) {
        event.preventDefault();
    }
    
    const searchTerm = document.getElementById('searchTerm').value.trim();
    if (!searchTerm) {
        alert('אנא הזן מונח חיפוש');
        return;
    }
    
    const exactMatch = document.getElementById('exactMatch')?.checked || false;
    
    try {
        const response = await fetch('/api/search/deep', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                searchTerm: searchTerm,
                options: {
                    exactMatch: exactMatch,
                    limit: 100
                }
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload page with results
            window.location.href = `/deepsearch?q=${encodeURIComponent(searchTerm)}&exact=${exactMatch}`;
        } else {
            alert('שגיאה בחיפוש: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('שגיאה בחיפוש');
    }
}

