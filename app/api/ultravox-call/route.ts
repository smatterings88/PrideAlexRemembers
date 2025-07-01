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
