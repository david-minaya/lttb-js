export interface Point {
  x: number;
  y: number;
}

export type StreamFunction = (offset: number, size: number) => AsyncGenerator<Point, void>;

export class LTTB {

  private length: number;
  private threshold: number;
  private bucketSize: number;
  private batchBucketSize: number;
  private buckets: Float64Array[];
  private lastBucketIndex = 0;
  private lastItemIndex = 0;
  private stream?: StreamFunction;

  constructor(items: Point[], threshold: number);
  constructor(length: number, threshold: number, batchSize: number, stream?: StreamFunction);
  constructor(itemsOrLength: number | Point[], threshold: number, batchSize = 1000, stream?: StreamFunction) {
    const isNumber = typeof itemsOrLength === 'number';
    this.length = isNumber ? itemsOrLength : itemsOrLength.length;
    this.threshold = Math.min(threshold, this.length);
    this.bucketSize = (this.length - 2) / (this.threshold - 2);
    this.batchBucketSize = Math.max(Math.ceil(batchSize / this.bucketSize), 3);
    this.stream = stream;
    this.buckets = new Array(this.threshold);
    if (!isNumber) {
      this.createBuckets(itemsOrLength);
    }
  }

  async process(): Promise<Point[]> {

    if (this.length === 0) return [];

    await this.loadData();

    const firstBucket = this.buckets[0];
    const firstPoint = { x: firstBucket[0], y: firstBucket[1] };
    const points: Point[] = [firstPoint];

    let prevPoint = firstPoint;

    for (let i = 1; i < this.buckets.length - 1; i++) {

      if (i+1 === this.lastBucketIndex) {
        await this.loadData();
      }
      
      const nextAvgPoint = this.calcAvgPoint(this.buckets[i+1]);
      const currentPoint = this.selectCurrentPoint(this.buckets[i], prevPoint, nextAvgPoint);

      this.buckets[i] = null as any;

      points.push(currentPoint);
      prevPoint = currentPoint;
    }

    const lastBucket = this.buckets[this.buckets.length - 1];
    const lastPoint = { x: lastBucket[0], y: lastBucket[1] };

    points.push(lastPoint);

    return points;
  }

  createBuckets(points: Point[]) {
    
    this.buckets[0] = new Float64Array([points[0].x, points[0].y]);

    for (let i = 1; i < this.buckets.length - 1; i++) {
      
      const start = Math.floor((i-1) * this.bucketSize) + 1;
      const end = Math.floor(((i-1) + 1) * this.bucketSize) + 1;
      const size = (end - start) * 2;
      const bucket = new Float64Array(size);

      for (let i = start, j = 0; i < end; i++, j += 2) {
        bucket[j] = points[i].x;
        bucket[j+1] = points[i].y;
      }

      this.buckets[i] = bucket;
    }

    const lastBucketIndex = this.buckets.length - 1;
    const lastItem = points[points.length - 1];

    this.buckets[lastBucketIndex] = new Float64Array([lastItem.x, lastItem.y]);
  }

  calcAvgPoint(bucket: Float64Array) {

    let x = 0;
    let y = 0;

    for (let i = 0; i < bucket.length; i += 2) {
      x += bucket[i];
      y += bucket[i + 1];
    }

    const bucketSize = bucket.length / 2;

    return {
      x: x / bucketSize,
      y: y / bucketSize
    }
  }

  selectCurrentPoint(bucket: Float64Array, prevPoint: Point, nextPoint: Point): Point {

    let max = -1;
    let point: Point | undefined = undefined;

    for (let i = 0; i < bucket.length; i += 2) {
      const currentPoint = { x: bucket[i], y: bucket[i+1] };
      const area = this.calcTriangleArea(prevPoint, currentPoint, nextPoint);
      if (area > max) {
        max = area;
        point = currentPoint;
      }
    }

    if (!point) {
      throw new Error('Point not found');
    }

    return point;
  }

  calcTriangleArea(a: Point, b: Point, c: Point): number {
    return Math.abs((a.x - c.x) * (b.y - a.y) - (a.x - b.x) * (c.y - a.y)) / 2;
  }

  async loadData() {

    if (!this.stream) return;

    const size = Math.min(Math.ceil(this.bucketSize * this.batchBucketSize), this.length - this.lastItemIndex);
    const items: AsyncGenerator<Point, Point> = this.stream(this.lastItemIndex, size) as AsyncGenerator<Point, any>;

    for (let i = this.lastBucketIndex; i < Math.min(this.batchBucketSize + this.lastBucketIndex, this.buckets.length); i++) {

      if (i === 0) {
        const item = await items.next();
        this.buckets[0] = new Float64Array([item.value.x, item.value.y]);
        this.lastItemIndex++;
        continue;
      }

      if (i === this.buckets.length - 1) {
        const item = await items.next();
        this.buckets[i] = new Float64Array([item.value.x, item.value.y]);
        this.lastItemIndex++;
        continue;
      }

      const start = Math.floor((i-1) * this.bucketSize) + 1;
      const end = Math.floor(((i-1) + 1) * this.bucketSize) + 1;
      const size = (end - start) * 2;
      const bucket = new Float64Array(size);

      for (let i = 0; i < size; i += 2) {
        const item = await items.next();
        bucket[i] = item.value.x;
        bucket[i+1] = item.value.y;
        this.lastItemIndex++;
      }

      this.buckets[i] = bucket;
    }

    this.lastBucketIndex += this.batchBucketSize;

    // Consume the leftover items of the stream
    for await (const item of items) {}
  }
}
