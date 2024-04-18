import { ListObjectsV2Command, ListObjectsV2CommandInput, S3, S3Client, PutObjectCommandInput } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import * as fs from 'fs'

// Set the AWS region
const s3Client = new S3Client({ region: 'us-east-1' })

// Specify the name of your bucket and the prefix (folder path)
const bucketName = 'compound-governance-proposals'

// Method to list all files in the specified folder
// This function lists all files in a specified folder
export async function listFilesInFolder(folderPath: string): Promise<string[]> {
  const files: string[] = []

  let isTruncated = true
  let continuationToken: string | undefined

  while (isTruncated) {
    const params: ListObjectsV2CommandInput = {
      Bucket: bucketName,
      Prefix: folderPath,
      ContinuationToken: continuationToken,
    }

    try {
      const response = await s3Client.send(new ListObjectsV2Command(params))

      response.Contents?.forEach((item) => {
        if (item.Key) {
          files.push(item.Key)
        }
      })

      continuationToken = response.NextContinuationToken
      isTruncated = !!response.IsTruncated
    } catch (error) {
      console.error('Error listing files:', error)
      throw error
    }
  }

  return files
}

export async function uploadFileToS3(key: string, filePath: string): Promise<void> {
  try {
    const fileStream = fs.createReadStream(filePath)

    const params: PutObjectCommandInput = {
      Bucket: bucketName,
      Key: key,
      Body: fileStream,
    }
    if (filePath.endsWith('.pdf')) {
      params.ContentType = 'application/pdf'
      params.ContentDisposition = 'inline'
    } else if (filePath.endsWith('.html')) {
      params.ContentType = 'text/html'
      params.ContentDisposition = 'inline'
    } else if (filePath.endsWith('.md')) {
      params.ContentType = 'text/markdown'
      params.ContentDisposition = 'inline'
    }
    const upload = new Upload({
      client: s3Client,
      params: params,
    })

    upload.on('httpUploadProgress', (progress) => {
      console.log(`Upload Progress: ${progress.loaded} / ${progress.total}`)
    })

    await upload.done()
    console.log('File uploaded successfully.')
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}
