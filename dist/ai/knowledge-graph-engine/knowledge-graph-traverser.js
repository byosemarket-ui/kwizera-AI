export class KnowledgeGraphTraverser {
    graph;
    constructor(graph) {
        this.graph = graph;
    }
    traverse(nodeId, maxDepth = 2) {
        const visited = new Set();
        const queue = [{ id: nodeId, depth: 0 }];
        const results = [];
        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current.id))
                continue;
            visited.add(current.id);
            if (current.id !== nodeId)
                results.push(current.id);
            if (current.depth >= maxDepth)
                continue;
            for (const neighbor of this.getNeighbors(current.id)) {
                if (!visited.has(neighbor)) {
                    queue.push({ id: neighbor, depth: current.depth + 1 });
                }
            }
        }
        return results;
    }
    neighborhood(nodeId, depth = 1) {
        return this.traverse(nodeId, depth);
    }
    shortestPath(sourceId, targetId) {
        const start = Date.now();
        if (!this.graph.getNode(sourceId) || !this.graph.getNode(targetId)) {
            return { found: false, path: [], edges: [], distance: -1, durationMs: Date.now() - start };
        }
        const queue = [sourceId];
        const visited = new Set([sourceId]);
        const parent = new Map();
        while (queue.length > 0) {
            const current = queue.shift();
            if (current === targetId)
                break;
            for (const edge of this.graph.getEdgesFor(current)) {
                const next = edge.targetId === current ? edge.sourceId : edge.targetId;
                if (visited.has(next))
                    continue;
                visited.add(next);
                parent.set(next, { prev: current, edge });
                queue.push(next);
            }
            for (const edge of this.graph.getAllEdges()) {
                if (edge.targetId !== current)
                    continue;
                const next = edge.sourceId;
                if (visited.has(next))
                    continue;
                visited.add(next);
                parent.set(next, { prev: current, edge });
                queue.push(next);
            }
        }
        if (!parent.has(targetId) && sourceId !== targetId) {
            return { found: false, path: [], edges: [], distance: -1, durationMs: Date.now() - start };
        }
        const path = [];
        const edges = [];
        let current = targetId;
        path.unshift(current);
        while (current !== sourceId) {
            const step = parent.get(current);
            if (!step)
                break;
            edges.unshift(step.edge);
            current = step.prev;
            path.unshift(current);
        }
        return {
            found: path[0] === sourceId,
            path,
            edges,
            distance: path.length - 1,
            durationMs: Date.now() - start,
        };
    }
    findPath(sourceId, targetId, maxDepth = 4) {
        const start = Date.now();
        const paths = [];
        const dfs = (current, target, visited, path, edges, depth) => {
            if (depth > maxDepth)
                return;
            if (current === target) {
                paths.push({ path: [...path], edges: [...edges] });
                return;
            }
            for (const edge of this.graph.getEdgesFor(current)) {
                const next = edge.targetId === current ? edge.sourceId : edge.targetId;
                if (visited.has(next))
                    continue;
                visited.add(next);
                dfs(next, target, visited, [...path, next], [...edges, edge], depth + 1);
                visited.delete(next);
            }
        };
        dfs(sourceId, targetId, new Set([sourceId]), [sourceId], [], 0);
        if (paths.length === 0) {
            return { found: false, path: [], edges: [], distance: -1, durationMs: Date.now() - start };
        }
        paths.sort((a, b) => a.path.length - b.path.length);
        const best = paths[0];
        return {
            found: true,
            path: best.path,
            edges: best.edges,
            distance: best.path.length - 1,
            durationMs: Date.now() - start,
        };
    }
    getNeighbors(nodeId) {
        const neighbors = new Set();
        for (const edge of this.graph.getEdgesFor(nodeId)) {
            neighbors.add(edge.targetId === nodeId ? edge.sourceId : edge.targetId);
        }
        for (const edge of this.graph.getAllEdges()) {
            if (edge.targetId === nodeId)
                neighbors.add(edge.sourceId);
        }
        return [...neighbors];
    }
}
export class KnowledgeGraphSearcher {
    graph;
    constructor(graph) {
        this.graph = graph;
    }
    searchNodes(query) {
        let nodes = this.graph.getAllNodes();
        if (query.nodeType) {
            nodes = nodes.filter((n) => n.nodeType === query.nodeType);
        }
        if (query.text) {
            const text = query.text.toLowerCase();
            nodes = nodes
                .map((n) => ({
                node: n,
                score: this.semanticScore(text, n.searchableText),
            }))
                .filter((s) => s.node.searchableText.includes(text) || s.score >= 0.08)
                .sort((a, b) => b.score - a.score)
                .map((s) => s.node);
        }
        return nodes.slice(0, query.limit ?? 20);
    }
    searchRelationships(query) {
        let edges = this.graph.getAllEdges();
        if (query.nodeId) {
            edges = edges.filter((e) => e.sourceId === query.nodeId || e.targetId === query.nodeId);
        }
        if (query.relationshipType) {
            edges = edges.filter((e) => e.relationshipType === query.relationshipType);
        }
        if (query.minStrength !== undefined) {
            edges = edges.filter((e) => e.strengthScore >= query.minStrength);
        }
        return edges.sort((a, b) => b.strengthScore - a.strengthScore).slice(0, query.limit ?? 50);
    }
    similaritySearch(nodeId, limit = 10) {
        const source = this.graph.getNode(nodeId);
        if (!source)
            return [];
        return this.graph
            .getAllNodes()
            .filter((n) => n.nodeId !== nodeId)
            .map((n) => ({
            node: n,
            score: this.semanticScore(source.searchableText, n.searchableText),
        }))
            .filter((s) => s.score >= 0.1)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((s) => s.node);
    }
    semanticScore(a, b) {
        const tokensA = a.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
        const tokensB = b.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
        if (tokensA.length === 0 || tokensB.length === 0)
            return 0;
        const intersection = tokensA.filter((t) => tokensB.includes(t));
        const union = new Set([...tokensA, ...tokensB]);
        return intersection.length / union.size;
    }
}
//# sourceMappingURL=knowledge-graph-traverser.js.map