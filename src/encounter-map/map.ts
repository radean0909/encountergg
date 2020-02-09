
import PoissonDisk = require('poisson-disk-sampling');
import { Voronoi, BoundingBox, Site, Diagram, Vertex, Cell } from 'voronoijs';
import { MapPoint, MapBorder, MapRegion, posToLocKey, edgeToBorderKey } from './types';

export class EncounterMap {

    width: number;
    height: number;

    points: Map<string, MapPoint> = new Map<string, MapPoint>();
    borders: Map<string, MapBorder> =new Map<string, MapBorder>();
    regions: Map<string, MapRegion> =new Map<string, MapRegion>();
    
    constructor(width:number, height:number, minDist: number) {

        this.width = width;
        this.height = height;

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
            if (startPoint) border.addPoint(startPoint)
            const endPoint = this.points.get(posToLocKey(end.x, end.y))
            if (endPoint) border.addPoint(endPoint)
            
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

        console.log(this.regions)
        
    }
}

