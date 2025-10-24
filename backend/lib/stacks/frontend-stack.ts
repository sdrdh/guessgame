import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';

export class FrontendStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly websiteUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = this.node.tryGetContext('domainName') || 'guessgame.sdrdhlab.xyz';
    const environmentTag = this.node.tryGetContext('environmentTag') || 'dev';

    // S3 Bucket for static website hosting (named after domain for CloudFlare)
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: domainName,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Deploy pre-built frontend to S3 (only if build directory exists)
    const frontendBuildDir = path.join(__dirname, '../../../frontend/build');

    // Check if build directory exists before creating deployment
    // This allows backend stacks to be synthesized without frontend build
    if (fs.existsSync(frontendBuildDir)) {
      new s3deploy.BucketDeployment(this, 'DeployFrontend', {
        sources: [s3deploy.Source.asset(frontendBuildDir)],
        destinationBucket: this.bucket,
      });
    } else {
      // Add a note in the stack that deployment is skipped
      new cdk.CfnOutput(this, 'DeploymentStatus', {
        value: 'Skipped - build directory not found. Run prepare-frontend.js first.',
        description: 'Frontend deployment status',
      });
    }

    // Website URL
    this.websiteUrl = this.bucket.bucketWebsiteUrl;

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: this.websiteUrl,
      description: 'S3 Website URL',
    });

    new cdk.CfnOutput(this, 'WebsiteEndpoint', {
      value: this.bucket.bucketWebsiteDomainName,
      description: 'S3 Website Endpoint - Use this for CloudFlare CNAME target',
    });

    new cdk.CfnOutput(this, 'CloudFlareInstructions', {
      value: `Add CNAME: guessgame -> ${this.bucket.bucketWebsiteDomainName} (Proxy: ON)`,
      description: 'CloudFlare Setup Instructions',
    });

    // Apply tags
    cdk.Tags.of(this).add('Project', 'GuessGame');
    cdk.Tags.of(this).add('Environment', environmentTag);
  }
}
