import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Image uploader listening on port ${config.port}`);
  console.log(`Serving images from: ${config.uploadDir}`);
  console.log(`Base URL: ${config.baseUrl}`);
});
