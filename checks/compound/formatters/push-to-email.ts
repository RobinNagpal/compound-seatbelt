import { toMarkdownAndHTML } from './../../../presentation/toMarkdownAndHTML'
import { GetObjectCommand, GetObjectCommandInput, S3Client } from '@aws-sdk/client-s3'
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses'
import { Readable } from 'stream'

const s3Client = new S3Client({ region: 'us-east-1' })
const sesClient = new SESClient({ region: 'us-east-1' })
const bucketName = process.env.AWS_BUCKET || 'compound-governance-proposals'
const senderEmail = process.env.SENDER_EMAIL || 'support@dodao.io'
const emailPath = process.env.AWS_BUCKET_EMAIL_PATH || 'proposal-update-subscribers'
const emailFileKey = emailPath ? `${emailPath}/email-list.txt` : 'email-list.txt'

const streamToString = (stream: Readable): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: any[] = []
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    stream.on('error', reject)
  })

export async function sendEmails(proposalNo: string, content: string) {
  if (!bucketName) throw new Error('AWS_BUCKET is not defined')
  if (!senderEmail) throw new Error('SENDER_EMAIL is not defined')

  // Fetch the email list
  let emails: string[] = []

  const params: GetObjectCommandInput = {
    Bucket: bucketName,
    Key: emailFileKey,
  }

  if (process.env.TEST_EMAIL) {
    console.log('Using test email:', process.env.TEST_EMAIL)
    emails = [process.env.TEST_EMAIL]
  } else {
    try {
      const file = await s3Client.send(new GetObjectCommand(params))

      if (file.Body instanceof Readable) {
        const fileContent = await streamToString(file.Body)
        emails = fileContent
          .split('\n') // Split by newline
          .map((email) => email.trim()) // Remove extra whitespace
          .filter((email) => email) // Filter out empty lines
        console.log('Fetched email list:', emails)
      }
    } catch (error) {
      console.error('Error fetching email list:', error)
      return { statusCode: 500, body: 'Failed to fetch email list.' }
    }
  }

  const emailBody = await generateHtmlReport(content)
  console.log('Email body', emailBody)

  // Send emails
  const emailPromises = emails.map((email) =>
    sesClient.send(
      new SendEmailCommand({
        Source: senderEmail,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: `Compound Proposal #${proposalNo} - Checks Summary` },
          Body: {
            Html: {
              Data: emailBody,
            },
          },
        },
      }),
    ),
  )

  try {
    await Promise.all(emailPromises)
    console.log('Emails sent successfully.')
    return { statusCode: 200, body: 'Emails sent successfully.' }
  } catch (error) {
    console.error('Error sending emails:', error)
    return { statusCode: 500, body: 'Failed to send emails.' }
  }
}

async function generateHtmlReport(content: string): Promise<string> {
  const { htmlReport } = await toMarkdownAndHTML(content)

  const emailBody = `
    <!DOCTYPE html>
    <html lang="en">

    <head>
        <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              color: #333333;
              margin: 0;
              padding: 0;
            }

            .container {
              padding: 20px;
            }

            .footer {
              font-size: 14px;
              color: #999999;
              margin-top: 30px;
            }

            .link {
              cursor: pointer;
              text-decoration: underline;
            }
        </style>
    </head>

    <body>
        <div class="container">
            ${htmlReport}
            <div class="footer">
                
                <p>Report created by <a href='https://dodao.io/' class="link" target='_blank'>DoDAO</a></p>
            </div>
        </div>
    </body>
    </html>`

  return emailBody
}
