#!/bin/bash

# Set up Stripe payment integration

set -e

echo "=================================="
echo "PodcastFlow Pro - Stripe Setup"
echo "=================================="

ENV=${1:-"production"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}This script will set up Stripe integration${NC}"
echo "Environment: ${ENV}"
echo ""
echo "Prerequisites:"
echo "1. Stripe account created at https://stripe.com"
echo "2. API keys from https://dashboard.stripe.com/apikeys"
echo ""
read -p "Do you have your Stripe API keys ready? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please get your Stripe keys first"
    exit 1
fi

# Get Stripe keys from user
echo ""
read -p "Enter your Stripe Publishable Key (pk_test_... or pk_live_...): " STRIPE_PK
read -p "Enter your Stripe Secret Key (sk_test_... or sk_live_...): " STRIPE_SK

# Determine if test or live mode
if [[ $STRIPE_PK == pk_test_* ]]; then
    MODE="test"
else
    MODE="live"
fi

echo ""
echo -e "${GREEN}Updating Stripe secrets in AWS Secrets Manager...${NC}"

# Update the Stripe secret
aws secretsmanager update-secret \
    --secret-id "podcastflow/${ENV}/stripe" \
    --secret-string "{
        \"publishable_key\": \"${STRIPE_PK}\",
        \"secret_key\": \"${STRIPE_SK}\",
        \"webhook_secret\": \"pending_webhook_setup\",
        \"mode\": \"${MODE}\"
    }" \
    --region us-east-1

echo -e "${GREEN}Creating Stripe webhook endpoint...${NC}"

# Create webhook endpoint using Stripe CLI if available
if command -v stripe &> /dev/null; then
    WEBHOOK_URL="https://api.podcastflow.pro/webhooks/stripe"
    
    echo "Creating webhook endpoint: ${WEBHOOK_URL}"
    WEBHOOK_SECRET=$(stripe webhooks create \
        --url ${WEBHOOK_URL} \
        --events checkout.session.completed,payment_intent.succeeded,payment_intent.failed,invoice.payment_succeeded,invoice.payment_failed \
        --api-key ${STRIPE_SK} \
        --format json | jq -r '.secret')
    
    # Update secret with webhook secret
    aws secretsmanager update-secret \
        --secret-id "podcastflow/${ENV}/stripe" \
        --secret-string "{
            \"publishable_key\": \"${STRIPE_PK}\",
            \"secret_key\": \"${STRIPE_SK}\",
            \"webhook_secret\": \"${WEBHOOK_SECRET}\",
            \"mode\": \"${MODE}\"
        }" \
        --region us-east-1
    
    echo -e "${GREEN}Webhook created successfully!${NC}"
else
    echo -e "${YELLOW}Stripe CLI not found. Manual webhook setup required.${NC}"
    echo ""
    echo "To complete webhook setup:"
    echo "1. Go to https://dashboard.stripe.com/webhooks"
    echo "2. Add endpoint URL: https://api.podcastflow.pro/webhooks/stripe"
    echo "3. Select events: checkout.session.completed, payment_intent.succeeded, etc."
    echo "4. Update the webhook secret in AWS Secrets Manager"
fi

echo -e "\n${GREEN}Creating Stripe integration Lambda function...${NC}"

# Create Stripe webhook handler Lambda
cat > /tmp/stripe-webhook-lambda.js << 'EOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const stripe = require('stripe');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secretsManager = new SecretsManagerClient({});

let stripeClient;
let webhookSecret;

async function initStripe() {
    if (!stripeClient) {
        const secret = await secretsManager.send(
            new GetSecretValueCommand({ SecretId: 'podcastflow/production/stripe' })
        );
        const stripeConfig = JSON.parse(secret.SecretString);
        stripeClient = stripe(stripeConfig.secret_key);
        webhookSecret = stripeConfig.webhook_secret;
    }
}

exports.handler = async (event) => {
    await initStripe();
    
    const sig = event.headers['stripe-signature'];
    let stripeEvent;
    
    try {
        stripeEvent = stripeClient.webhooks.constructEvent(
            event.body,
            sig,
            webhookSecret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid signature' })
        };
    }
    
    // Handle the event
    switch (stripeEvent.type) {
        case 'checkout.session.completed':
            await handleCheckoutComplete(stripeEvent.data.object);
            break;
        case 'payment_intent.succeeded':
            await handlePaymentSuccess(stripeEvent.data.object);
            break;
        case 'invoice.payment_succeeded':
            await handleInvoicePayment(stripeEvent.data.object);
            break;
        default:
            console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ received: true })
    };
};

async function handleCheckoutComplete(session) {
    // Record successful checkout
    await dynamodb.send(new PutCommand({
        TableName: process.env.TABLE_NAME || 'podcastflow-pro',
        Item: {
            PK: `PAYMENT#${session.id}`,
            SK: 'CHECKOUT',
            GSI1PK: 'PAYMENTS',
            GSI1SK: new Date().toISOString(),
            type: 'checkout_completed',
            customerId: session.customer,
            amount: session.amount_total,
            currency: session.currency,
            status: 'completed',
            metadata: session.metadata,
            createdAt: new Date().toISOString()
        }
    }));
}

async function handlePaymentSuccess(paymentIntent) {
    console.log('Payment succeeded:', paymentIntent.id);
}

async function handleInvoicePayment(invoice) {
    console.log('Invoice paid:', invoice.id);
}
EOF

echo -e "${GREEN}Updating environment configuration...${NC}"

# Add Stripe configuration to .env.production
cat >> ../../.env.production << EOF

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK}
STRIPE_MODE=${MODE}
EOF

echo -e "\n${GREEN}Creating Stripe components...${NC}"

# Create Stripe payment component
cat > ../../src/components/stripe/StripeCheckout.tsx << 'EOF'
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Button, Box, Alert, CircularProgress } from '@mui/material'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CheckoutFormProps {
  amount: number
  onSuccess: (paymentIntent: any) => void
  onError: (error: string) => void
}

function CheckoutForm({ amount, onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    try {
      // Create payment intent on your server
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })

      const { clientSecret } = await response.json()

      // Confirm the payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      })

      if (result.error) {
        setError(result.error.message || 'Payment failed')
        onError(result.error.message || 'Payment failed')
      } else {
        onSuccess(result.paymentIntent)
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed')
      onError(err.message || 'Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ mb: 3 }}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={!stripe || loading}
        startIcon={loading && <CircularProgress size={20} />}
      >
        {loading ? 'Processing...' : `Pay $${(amount / 100).toFixed(2)}`}
      </Button>
    </form>
  )
}

export default function StripeCheckout(props: CheckoutFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  )
}
EOF

# Create payment API route
cat > ../../src/app/api/create-payment-intent/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import Stripe from 'stripe'

const secretsManager = new SecretsManagerClient({ region: 'us-east-1' })

let stripe: Stripe

async function getStripe() {
  if (!stripe) {
    const secret = await secretsManager.send(
      new GetSecretValueCommand({ SecretId: 'podcastflow/production/stripe' })
    )
    const stripeConfig = JSON.parse(secret.SecretString!)
    stripe = new Stripe(stripeConfig.secret_key, {
      apiVersion: '2023-10-16',
    })
  }
  return stripe
}

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json()
    const stripe = await getStripe()

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
EOF

echo -e "\n${GREEN}Installing Stripe dependencies...${NC}"
cd ../.. && npm install --save stripe @stripe/stripe-js @stripe/react-stripe-js

echo -e "\n${GREEN}Stripe setup complete!${NC}"
echo ""
echo "✅ Stripe keys stored in AWS Secrets Manager"
echo "✅ Payment components created"
echo "✅ API routes configured"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. ${MODE} mode is configured"
if [[ $MODE == "test" ]]; then
    echo "2. Test with Stripe test cards: https://stripe.com/docs/testing"
    echo "3. Switch to live mode when ready for production"
fi
echo ""
echo "Webhook endpoint: https://api.podcastflow.pro/webhooks/stripe"