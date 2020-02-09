import { Edge } from 'voronoijs';

// MapLocation - represents a basic x,y position with additional data
export interface MapLocation {
    pos: [number, number];
    height: number;
    precipitation: number;
    temperature: number;
    flux: number;
    flow: MapLocation;

    serializeKey():string;
}

// MapRegion - represents a single region on the map and upgrades a voronoi Cell
export class MapRegion implements MapLocation {

    id: number;

    // relatives
    neighbors: Array<MapRegion> = [];
    borders: Array<MapBorder> = [];
    points: Array<MapPoint> = [];

    // details
    pos: [number, number];
    height: number;
    precipitation: number;
    temperature: number;

    // erosion
    flux: number;
    flow: MapLocation;

    constructor(pos:[number,number]) {
        this.pos = pos;
    }

    serializeKey():string {
        return this.pos.toString();
    }

    addPoint(point:MapPoint):void {
        if (!this.points.includes(point)) this.points.push(point);
    }

    addBorder(border:MapBorder):void {
        if (!this.borders.includes(border)) this.borders.push(border);
    }

    addNeighbor(region:MapRegion):void {
        if (!this.neighbors.includes(region)) this.neighbors.push(region);
    }

}

// MapPoint - represents a particular point on an edge of a cell (or as part of a Border) and upgrades a voronoi Vertex
export class MapPoint implements MapLocation {
    
    id: number;

    // relatives
    neighbors: Array<MapPoint> = [];
    borders: Array<MapBorder> = [];
    regions: Array<MapRegion> = [];

    // details
    pos: [number, number];
    height: number;
    precipitation: number;
    temperature: number;

    // erosion
    flux: number;
    flow: MapLocation;

    constructor(pos:[number,number]) {
        this.pos = pos;
    }

    serializeKey():string {
        return this.pos.toString();
    }

    addNeighbor(point:MapPoint):void {
        if (!this.neighbors.includes(point)) this.neighbors.push(point);
    }

    addBorder(border:MapBorder):void {
        if (!this.borders.includes(border)) this.borders.push(border);
    }

    addRegion(region:MapRegion):void {
        if (!this.regions.includes(region)) this.regions.push(region);
    }
    
}

// MapBorder - represents a border to a region and upgrades a voronoi Halfedge (it actually contains two half-edges)
export class MapBorder {
    id: number;

    // relatives
    regions: Array<MapRegion> = [];
    points: Array<MapPoint> = [];
    neighbors: Array<MapBorder> = [];
    edge:Edge;

    // details
    river: boolean;
    coast: boolean;
    burg: boolean;

    constructor(edge:Edge) {
        this.edge = edge;
    }

    serializeKey():string {
        return "[" + this.edge.va.x.toString() + "," +this.edge.va.y.toString() +"]"
             + "[" + this.edge.vb.x.toString() + "," +this.edge.vb.y.toString() +"]";
    }

    addPoint(point:MapPoint):void {
        if (!this.points.includes(point)) this.points.push(point);
    }

    addNeighbor(border:MapBorder):void {
        if (!this.neighbors.includes(border)) this.neighbors.push(border);
    }

    addRegion(region:MapRegion):void {
        if (!this.regions.includes(region)) this.regions.push(region);
    }
}

export function posToLocKey(x:number, y:number):string {
    return [x, y].toString();
}

export function edgeToBorderKey(edge:Edge):string {
    return "[" + edge.va.x.toString() + "," +edge.va.y.toString() +"]"
             + "[" + edge.vb.x.toString() + "," +edge.vb.y.toString() +"]";
}