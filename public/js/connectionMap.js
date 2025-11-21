/**
 * Connection Map Visualization
 */

let network = null;
let nodes = null;
let edges = null;

// Load connection map on page load
document.addEventListener('DOMContentLoaded', function() {
    loadConnectionMap();
});

async function loadConnectionMap() {
    try {
        const response = await fetch('/api/connections/map');
        const data = await response.json();
        
        if (data.success && data.map) {
            updateMap(data.map);
        }
    } catch (error) {
        console.error('Error loading connection map:', error);
    }
}

function updateMap(mapData) {
    // Update statistics
    document.getElementById('totalNodes').textContent = mapData.nodes.length;
    document.getElementById('totalEdges').textContent = mapData.edges.length;
    
    // Create nodes
    nodes = new vis.DataSet(mapData.nodes.map(node => ({
        id: node.id,
        label: node.name,
        shape: 'box',
        color: {
            background: '#e3f2fd',
            border: '#1976d2',
            highlight: { background: '#bbdefb', border: '#0d47a1' }
        }
    })));
    
    // Create edges
    edges = new vis.DataSet(mapData.edges.map(edge => ({
        id: edge.id,
        from: edge.source,
        to: edge.target,
        label: edge.type,
        arrows: 'to',
        color: { color: '#666' }
    })));
    
    // Create network
    const container = document.getElementById('connectionMap');
    const data = { nodes: nodes, edges: edges };
    const options = {
        nodes: {
            shape: 'box',
            font: { size: 14 },
            margin: 10
        },
        edges: {
            arrows: { to: { enabled: true } },
            font: { size: 12, align: 'middle' },
            smooth: { type: 'continuous' }
        },
        physics: {
            enabled: true,
            stabilization: { iterations: 200 }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200
        },
        layout: {
            improvedLayout: true,
            hierarchical: {
                enabled: false
            }
        }
    };
    
    network = new vis.Network(container, data, options);
    
    // Handle node selection
    network.on('select', function(params) {
        document.getElementById('selectedNodes').textContent = params.nodes.length;
        
        if (params.nodes.length === 1) {
            const nodeId = params.nodes[0];
            // Optionally navigate to item page
            // window.location.href = `/datablocks?search=${encodeURIComponent(nodeId)}`;
        }
    });
    
    // Handle double click
    network.on('doubleClick', function(params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            window.location.href = `/connections/item/${encodeURIComponent(nodeId)}`;
        }
    });
}

// Filter nodes
document.getElementById('itemFilter')?.addEventListener('input', function(e) {
    const filter = e.target.value.toLowerCase();
    if (!nodes) return;
    
    const filteredNodes = nodes.get().filter(node => 
        node.label.toLowerCase().includes(filter)
    );
    
    nodes.update(filteredNodes.map(node => ({ id: node.id, hidden: false })));
    nodes.get().forEach(node => {
        if (!filteredNodes.find(n => n.id === node.id)) {
            nodes.update({ id: node.id, hidden: true });
        }
    });
});

