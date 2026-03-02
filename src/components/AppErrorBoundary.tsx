import NetInfo from '@react-native-community/netinfo';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import OfflineErrorFallback from './OfflineErrorFallback';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  isOffline: boolean;
  retryCount: number;
};

class AppErrorBoundary extends React.Component<Props, State> {
  private unsubscribeNetInfo?: () => void;

  state: State = {
    hasError: false,
    isOffline: false,
    retryCount: 0,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidMount() {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      this.setState({ isOffline: offline });
    });
  }

  componentWillUnmount() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  componentDidCatch(error: Error) {
    console.error('[AppErrorBoundary] Error capturado:', error);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    const { hasError, isOffline, retryCount } = this.state;

    if (hasError && isOffline) {
      return (
        <OfflineErrorFallback
          title="Sin internet"
          message="Se produjo un error mientras estabas sin conexión. Revisa tu red y vuelve a intentarlo."
          onRetry={this.handleRetry}
        />
      );
    }

    if (hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Ocurrió un error</Text>
            <Text style={styles.message}>Intenta continuar recargando esta vista.</Text>
            <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return <React.Fragment key={retryCount}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FFF4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1E8D5',
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A3026',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#4A4A4A',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2E8B57',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default AppErrorBoundary;
