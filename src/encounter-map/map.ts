
import PoissonDisk = require('poisson-disk-sampling');
import { Voronoi, BoundingBox, Site, Diagram, Vertex, Cell } from 'voronoijs';
import { MapPoint, MapBorder, MapRegion, posToLocKey, edgeToBorderKey } from './types';

export class EncounterMap {

    static SEALEVEL = 2;
    
    width: number;
    height: number;
    unit: number;


    points: Map<string, MapPoint> = new Map<string, MapPoint>();
    borders: Map<string, MapBorder> =new Map<string, MapBorder>();
    regions: Map<string, MapRegion> =new Map<string, MapRegion>();
    
    constructor(width:number, height:number, minDist: number) {

        this.width = width;
        this.height = height;

        this.unit = Math.min(width, height) / 20;

        const Sampler = new PoissonDisk({
            shape: [width, height], 
            minDistance: minDist,
        })
        const points = Sampler.fill()
        const sites = [];


        points.forEach((pt:[number, number]) => {
            sites.push({ x: pt[0], y:pt[1]});
        });

        const voronoi = new Voronoi();
        const bbox: BoundingBox = {xl:0, xr: width, yt:0, yb: height};
        const diagram = voronoi.compute(sites, bbox);

        console.time("upgrading voronoi")
        // set up our upgraded objects
        for (let i = 0; i < diagram.vertices.length; i++) {
            const v = diagram.vertices[i];
            const point = new MapPoint([v.x, v.y]);
            point.id = i;
            this.points.set(point.serializeKey(), point);
        }

        for (let i = 0; i < diagram.cells.length; i++) {
            const c = diagram.cells[i];
            const region = new MapRegion([c.site.x, c.site.y]);
            region.id = i;
            this.regions.set(region.serializeKey(), region);
        }
        console.timeEnd("upgrading voronoi");

        console.time("adding relationship data")
        for (let i = 0; i < diagram.edges.length; i++) {
            const e = diagram.edges[i];
            const border = new MapBorder(e);
            border.id = i;

            const start = e.va;
            const end = e.vb;

            // add the points
            const startPoint = this.points.get(posToLocKey(start.x, start.y))
            if (startPoint) {
                border.addPoint(startPoint)
                startPoint.addBorder(border);
            }
            const endPoint = this.points.get(posToLocKey(end.x, end.y))
            if (endPoint) {
                border.addPoint(endPoint)
                endPoint.addBorder(border);
            }
            
            this.borders.set(border.serializeKey(), border);
        }

        // fill in relationship data
        for (let i = 0; i < diagram.cells.length; i++) {
            
            const cell = diagram.cells[i];
            const region = this.regions.get(posToLocKey(cell.site.x, cell.site.y));
            
            if (!region) continue;

            // add the borders & points
            for (const he of cell.halfedges) {
                const edge = he.edge

                const start = edge.va;
                const end = edge.vb;
                
                // add the points
                const startPoint = this.points.get(posToLocKey(start.x, start.y))
                if (startPoint) {
                    region.addPoint(startPoint)
                    startPoint.addRegion(region);
                }
                const endPoint = this.points.get(posToLocKey(end.x, end.y))
                if (endPoint) {
                    region.addPoint(endPoint)
                    endPoint.addRegion(region);
                }

                // and the border
                const border = this.borders.get(edgeToBorderKey(edge))
                if (border) {
                    region.addBorder(border);
                    border.addRegion(region);
                }

            }

            // add neighbor regions
            for (const n of cell.getNeighborIds()) {
                const nCell = diagram.cells[n];
                const nRegion = this.regions.get(posToLocKey(nCell.site.x, nCell.site.y))
                if (nRegion) region.addNeighbor(nRegion);
            }
        }

        for (const [key, border] of this.borders) {
            for (const pointA of border.points) {
                for (const nBorder of pointA.borders) {
                    if (border != nBorder) {
                        border.addNeighbor(nBorder);
                    }
                }
                for (const pointB of border.points) {
                    if (pointA != pointB) {
                        pointA.addNeighbor(pointB);
                        pointB.addNeighbor(pointA);
                    }
                }
            }
        }
        console.timeEnd("adding relationship data")
    }

    addHill(pos:[number, number], r:number, h:number):void {
        const c1 = (4/9) * Math.pow(r, -6);
        const c2 = (17/9) * Math.pow(r, -4);
        const c3 = (22/9) * Math.pow(r, -2);
        const rsq = Math.pow(r, 2);
        
        // points
        for(const [key, point] of this.points) {
            const dx = point.pos[0] - pos[0];
            const dy = point.pos[1] - pos[1];
            const dsq = Math.pow(dx, 2) + Math.pow(dy, 2);

            if (dsq < rsq) {
                const kernel = 1 - c1 * Math.pow(dsq, 3) + c2*Math.pow(dsq, 2) - c3*dsq
                point.height += h * kernel
            }
        }

        // regions
        for(const [key, region] of this.regions) {
            const dx = region.pos[0] - pos[0];
            const dy = region.pos[1] - pos[1];
            const dsq = Math.pow(dx, 2) + Math.pow(dy, 2);

            if (dsq < rsq) {
                const kernel = 1 - c1 * Math.pow(dsq, 3) + c2*Math.pow(dsq, 2) - c3*dsq
                region.height += h * kernel
            }
        }
    }

    addCone(pos:[number, number], r:number, h:number):void {
        const ir = 1/ r;
        const rsq = Math.pow(r, 2);
        
        // points
        for(const [key, point] of this.points) {
            const dx = point.pos[0] - pos[0];
            const dy = point.pos[1] - pos[1];
            const dsq = Math.pow(dx, 2) + Math.pow(dy, 2);
            if (dsq < rsq) {
                const dist = Math.sqrt(dsq);
                const kernel = 1 - dist*ir;
                point.height += h * kernel;
            }
        }
        // regions
        for(const [key, region] of this.regions) {
            const dx = region.pos[0] - pos[0];
            const dy = region.pos[1] - pos[1];
            const dsq = Math.pow(dx, 2) + Math.pow(dy, 2);
            if (dsq < rsq) {
                const dist = Math.sqrt(dsq);
                const kernel = 1 - dist*ir;
                region.height += h * kernel;
            }
        }
    }

    addSlope(loc:[number, number], dir:[number, number], r:number, h:number):void {
        // points
        for(const [key, point] of this.points) {
            const dx = point.pos[0] - loc[0];
            const dy = point.pos[1] - loc[1];
            const dot = dx * dir[0] + dy*dir[1];
            const distx = dx - dot*dir[0];
            const disty = dy - dot*dir[1];
            let dist = Math.sqrt(distx*distx + disty*disty);

            dist = Math.min(dist, r);
            const cross = dx*dir[1] - dy*dir[0];
            let min = 0;
            let max = 0;
            if (cross < 0 ) {
                min = .5 * h;
            } else {
                min = .5 * h;
                max = h;
            }

            const kernel = min + (dist/r)*(max-min);
            point.height += kernel;
        }

        // regions
        for(const [key, region] of this.regions) {
            const dx = region.pos[0] - loc[0];
            const dy = region.pos[1] - loc[1];
            const dot = dx * dir[0] + dy*dir[1];
            const distx = dx - dot*dir[0];
            const disty = dy - dot*dir[1];
            let dist = Math.sqrt(distx*distx + disty*disty);

            dist = Math.min(dist, r);
            const cross = dx*dir[1] - dy*dir[0];
            let min = 0;
            let max = 0;
            if (cross < 0 ) {
                min = .5 * h;
            } else {
                min = .5 * h;
                max = h;
            }

            const kernel = min + (dist/r)*(max-min);
            region.height += kernel;
        }
    }

    addRange(loc:[number, number], dir:[number, number], a:number, b:number, h:number, count:number):void {
        
        if (a > b) {
            const temp = a;
            a = b;
            b = temp;
        }

        let added = 0;

        while (added < count) {
            // points
            for(const [key, point] of this.points) {
                if (added >= count) break;
                const phi = Math.atan(dir[1]/ dir[0]);
                const d = Math.pow(Math.cos(phi) *(point.pos[0] - loc[0]) + Math.sin(phi)*(point.pos[1] - loc[1]), 2) / Math.pow(a, 2) +
                            Math.pow(Math.sin(phi) *(point.pos[0] - loc[0]) - Math.cos(phi)*(point.pos[1] - loc[1]), 2) / Math.pow(b, 2);
                if (d <= 1 && Math.random() < .1) {
                    added++;
                    // Add a hill or cone at this location
                    const r = (Math.random() * (h - a) + a) * this.unit;
                    const tempH = (h/2) + (h * (1-d) / 2);
                    if (Math.random() < .5) {
                        this.addCone(point.pos, r, tempH);
                    } else {
                        this.addHill(point.pos, r, tempH);
                    }
                }
            }

            // regions
            for(const [key, region] of this.regions) {
                if (added >= count) break;
                const phi = Math.atan(dir[1]/ dir[0]);
                const d = Math.pow(Math.cos(phi) *(region.pos[0] - loc[0]) + Math.sin(phi)*(region.pos[1] - loc[1]), 2) / Math.pow(a, 2) +
                            Math.pow(Math.sin(phi) *(region.pos[0] - loc[0]) - Math.cos(phi)*(region.pos[1] - loc[1]), 2) / Math.pow(b, 2);
                if (d <= 1 && Math.random() < .1) {
                    added++;
                    // Add a hill or cone at this location
                    const r = (Math.random() * (h - a) + a) * this.unit;
                    const tempH = (h/2) + (h * (1-d) / 2);
                    if (Math.random() < .5) {
                        this.addCone(region.pos, r, tempH);
                    } else {
                        this.addHill(region.pos, r, tempH);
                    }
                }
            }
        }
    }

    setLandAndSea(sealevel:number):void {
        // points
        for(const [key, point] of this.points) {
            if (point.height > sealevel) point.attributes.set("land", true);
        }

        // regions
        for(const [key, region] of this.regions) {
            if (region.height > sealevel) region.attributes.set("land", true);
        }

        // borders
        for(const [key, border] of this.borders) {
            let hasLand = false;
            let hasSea = false;
            for (const region of border.regions) {
                if (region.attributes.has("land")) hasLand = true;
                else hasSea = true;
            }

            if (hasLand && hasSea) {
                border.coast = true;
            }
        }
    }

    getCoastLines():Array<Array<MapBorder>> {
        console.time("getCoastLines")
        const coasts:Array<Array<MapBorder>> = [];
        
        const added:Map<string, boolean> = new Map<string, boolean>();

        for (const [key, border] of this.borders) {
            if (border.coast) {
                const start = border.findCoastStart();
                if (start) {
                    const coast:Array<MapBorder> = [];
                    const queue: Array<MapBorder> = [start];
                    while(queue.length) {
                        const cur = queue.pop();
                        if (!cur || !cur.coast) break;
                        if (!added.has(cur.serializeKey())) {
                            added.set(cur.serializeKey(), true);
                            coast.push(cur);
                            queue.push(...cur.neighbors.filter(n => n.coast));
                        }
                    }
                    if (coast.length > 0) coasts.push(coast);
                }
            }
        }
        console.timeEnd("getCoastLines")
        return coasts;
    }

}

