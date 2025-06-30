import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_ULTRAVOX_API_KEY) {
      console.error('Missing Ultravox API key');
      return NextResponse.json(
        { error: 'Server configuration error: Missing Ultravox API key' },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_AGENT_ID) {
      console.error('Missing Agent ID');
      return NextResponse.json(
        { error: 'Server configuration error: Missing Agent ID' },
        { status: 500 }
      );
    }

    // Get request body
    const body = await request.json();
    const { firstName, lastCallTranscript, currentTime, userLocation, totalCalls, alexEthnicity, walletBalance } = body;

    // Use wallet balance passed from client for maxDuration
    let maxDurationSeconds = 3600; // Default 1 hour
    if (walletBalance && walletBalance > 0) {
      // Set maxDuration to the user's balance (in seconds)
      // Add a small buffer (30 seconds) to account for connection time
      maxDurationSeconds = Math.max(walletBalance + 30, 60); // Minimum 1 minute
      
      console.log('📊 Using wallet balance for maxDuration:', {
        walletBalance,
        maxDurationSeconds
      });
    }

    // Always use the default agent (NEXT_PUBLIC_AGENT_ID) for Pride Alex
    const agentId = process.env.NEXT_PUBLIC_AGENT_ID;

    const apiUrl = `https://api.ultravox.ai/api/agents/${agentId}/calls`;

    console.log('🚀 Calling Ultravox API:', {
      url: apiUrl,
      hasApiKey: !!process.env.NEXT_PUBLIC_ULTRAVOX_API_KEY,
      firstName,
      userLocation,
      totalCalls,
      maxDurationSeconds,
      agentType: 'Pride Alex'
    });

    // Add retry logic and better error handling
    let response: Response | null = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.NEXT_PUBLIC_ULTRAVOX_API_KEY,
            'User-Agent': 'AlexListens/1.0',
          },
          body: JSON.stringify({
            templateContext: {
              userFirstname: firstName || 'User',
              lastCallTranscript: lastCallTranscript || 'No previous call. This is the first call',
              currentTime: currentTime || new Date().toLocaleTimeString(),
              userLocation: userLocation || 'Unknown Location',
              userTotalCalls: totalCalls?.toString() || '0'
            },
            initialMessages: [],
            metadata: {},
            medium: {
              webRtc: {}
            },
            joinTimeout: "300s",
            maxDuration: `${maxDurationSeconds}s`, // Use wallet balance as maxDuration
            recordingEnabled: false,
            initialOutputMedium: "MESSAGE_MEDIUM_VOICE",
            firstSpeakerSettings: {
              agent: {}
            },
            experimentalSettings: {}
          }),
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        // If we get here, the request succeeded
        break;
      } catch (error: unknown) {
        retryCount++;
        console.error(`Ultravox API attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          // Check if it's a network/connection error
          if (error instanceof TypeError && error.message.includes('fetch')) {
            return NextResponse.json(
              { error: 'Unable to connect to voice service. Please check your internet connection and try again.' },
              { status: 503 }
            );
          } else if (error instanceof Error && error.name === 'TimeoutError') {
            return NextResponse.json(
              { error: 'Voice service request timed out. Please try again.' },
              { status: 504 }
            );
          } else {
            return NextResponse.json(
              { error: 'Voice service is temporarily unavailable. Please try again in a few moments.' },
              { status: 503 }
            );
          }
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    // Check if response is null (all retries failed)
    if (!response) {
      return NextResponse.json(
        { error: 'Voice service is temporarily unavailable. Please try again in a few moments.' },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Ultravox API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        agentId: agentId?.substring(0, 8) + '...'
      });

      // Provide more specific error messages based on status code
      let errorMessage = 'Failed to create voice call';
      if (response.status === 401) {
        errorMessage = 'Invalid API credentials. Please check your configuration.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. Please check your API permissions.';
      } else if (response.status === 404) {
        errorMessage = 'Voice agent not found. Please check your agent configuration.';
      } else if (response.status >= 500) {
        errorMessage = 'Voice service is temporarily unavailable. Please try again.';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Ultravox API success:', {
      joinUrl: data.joinUrl,
      maxDurationSeconds,
      agentType: 'Pride Alex'
    });
    
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('API route error:', error);
    
    // Provide more specific error messages
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Unable to connect to voice service. Please try again.' },
        { status: 503 }
      );
    } else {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
