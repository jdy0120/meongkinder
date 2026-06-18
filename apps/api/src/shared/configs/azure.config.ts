import { BlobServiceClient } from "@azure/storage-blob";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

const gameBlobConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const gameBlobContainerName = process.env.AZURE_GAME_BLOB_CONTAINER_NAME;

export const azureConfig = {
  connectionString,
  containerName,
};

// Create and export the container client as a singleton if connection string is configured
export const containerClient =
  connectionString && containerName
    ? BlobServiceClient.fromConnectionString(
        connectionString,
      ).getContainerClient(containerName)
    : null;

export const azureGameBlobConfig = {
  connectionString: gameBlobConnectionString,
  containerName: gameBlobContainerName,
};

export const gameBlobContainerClient =
  gameBlobConnectionString && gameBlobContainerName
    ? BlobServiceClient.fromConnectionString(
        gameBlobConnectionString,
      ).getContainerClient(gameBlobContainerName)
    : null;
