pipeline {
    agent any
    environment {
        DOCKER_HUB_CREDENTIALS_ID = 'dockerhub-access'
        DOCKER_HUB_REPO = 'sbsmrth/products-app-orders-ms'
    }
    stages {
        stage('Docker Build') {
            steps {
                script {
                    dockerImage = docker.build(
                        "${DOCKER_HUB_REPO}:latest", 
                        "-f Dockerfile.prod ."
                    )
                }
            }
        }
        stage('Docker Push') {
            steps {
                script {
                    docker.withRegistry("https://registry.hub.docker.com", "${DOCKER_HUB_CREDENTIALS_ID}") {
                        dockerImage.push("latest")
                    }
                }
            }
        }
    }
    post {
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}