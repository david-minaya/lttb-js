# lttb-js

`lttb-js` is a high-performance, memory-efficient implementation of the Largest-Triangle-Three-Buckets (LTTB) algorithm. It is designed to downsample massive datasets from thousands, millions or hundreds of millions of points without crashing your runtime or requiring massive RAM overhead.

### Performance tests

| Container | Memory limit | Dataset length | Dataset size (Approx.) |
|-----------|--------------|----------------|------------------------|
| node:slim | 50 MB        | 109,548,080    | 1.7 GB                 |
| node:slim | 100 MB       | 1,095,480,800  | 16.8 GB                |


## Installation

```bash
npm install lttb-js
```

## Usage

For small datasets with a few thousand elements or less, use the `lttb` function.

```ts
import { lttb } from 'lttb-js';

const dataset = [
  { x: 1, y: 23.32 },
  { x: 2, y: 98.42 },
  { x: 3, y: 15.45 },
  ...
  // 10,000 items
];

const threshold = 100;

const result = await lttb(dataset, threshold);
```

### Streaming

For large datasets with millions or hundreds of millions of elements, you should use `lttbStream` to keep memory usage to a minimum.

```ts
import { lttbStream } from 'lttb-js';

const datasetLength = 1_023_435;
const threshold = 1334;
const batchSize = 20_000;

const result = await lttbStream(
  datasetLength, 
  threshold, 
  batchSize, 
  async function* (offset: number, size: number) {
    // Stream the data from an API, a database, or another source
    const stream = await streamDataFromDatabase(offset, size);

    for await (const item of stream) {
      yield { x: item.x, y: item.y };
    }
  }
);
```

The `lttbStream` function loads the data as it processes it, preventing load the whole dataset into memory. Every time it is ready for more data, it calls the callback function to fetch the next batch.

### Batch requests

If your API or database doesn't support streaming, you can fetch the data normally and pass it to `lttbStream` in the following way:

```ts
const result = await lttbStream(..., async function* (offset: number, size: number) {

  // Fetch the data from an API, a database, or another source
  const data = await fetchDataFromDatabase(offset, size);

  for (const item of data) {
    yield { x: item.x, y: item.y };
  }
});
```

Notice that here we are using a normal `for` loop and not `for await`.

Or, if your data already arrives in the `{ x: number, y: number }` format, you can pass it directly using `yield*`:

```ts
const result = await lttbStream(..., async function* (offset: number, size: number) {
  // Fetch the data from an API, a database, or another source
  const data = await fetchDataFromDatabase(offset, size);
  yield* data;
});
```

## Reference

### lttb

```ts
lttb(items: Point[], threshold: number): Promise<Point[]>
```

- **items**: List of data points to process.
- **threshold**: The number of points to return.

### lttbStream

```ts
lttbStream(
  length: number, 
  threshold: number, 
  batchSize: number, 
  streamFunction: (offset: number, size: number) => AsyncGenerator<Point, void>
): Promise<Point[]>
```

- **length**: The total length of the dataset.
- **threshold**: The number of points to return.
- **batchSize**: The number of items to load each time.
- **streamFunction**: Function called to load more data.

### `Point`

```ts
interface Point {
  x: number;
  y: number;
}
```
