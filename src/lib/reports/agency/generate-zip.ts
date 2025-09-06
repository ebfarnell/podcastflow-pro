import JSZip from 'jszip'
import { ReportArtifacts } from './generate-artifacts'

export interface ReportMetadata {
  reportId: string
  generatedAt: string
  agency: string
  agencyId: string
  dateRange: {
    start: string
    end: string
  }
  files: string[]
  generatedBy: string
  organizationId: string
}

export async function generateZipBuffer(
  artifacts: ReportArtifacts,
  metadata: ReportMetadata
): Promise<Buffer> {
  const zip = new JSZip()
  
  // Add all artifacts to ZIP
  const artifactKeys = Object.keys(artifacts)
  artifactKeys.forEach(function(filename) {
    const content = artifacts[filename]
    zip.file(filename, content)
  })

  // Add metadata file
  const metadataJson = JSON.stringify(metadata, null, 2)
  zip.file('_metadata.json', metadataJson)

  // Generate ZIP buffer
  const zipBuffer = await zip.generateAsync({ 
    type: 'nodebuffer', 
    compression: 'DEFLATE' 
  })

  return zipBuffer
}